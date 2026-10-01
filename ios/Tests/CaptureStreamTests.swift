import Foundation
import CryptoKit

/// Synthetic file only; every request is intercepted. No network or user recording is used.
private final class CaptureStreamProtocol: URLProtocol {
    static let lock = NSLock()
    static var calls = 0
    static var receivedBytes = 0
    static var receivedDigest = ""
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        var digest = SHA256()
        var total = 0
        if let stream = request.httpBodyStream {
            stream.open()
            defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 4096)
            while true {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                digest.update(data: Data(buffer.prefix(count)))
                total += count
            }
        }
        Self.lock.withLock {
            Self.calls += 1
            Self.receivedBytes = total
            Self.receivedDigest = digest.finalize().map { String(format: "%02x", $0) }.joined()
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@main struct CaptureStreamTests {
    static func main() async throws {
        let suite = "capture-stream-test-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let permission = AIProcessingPermission(defaults: defaults)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [CaptureStreamProtocol.self]
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: file) }
        let bytes = Data((0..<180_000).map { UInt8($0 % 251) })
        try bytes.write(to: file)
        func request() -> URLRequest {
            var result = URLRequest(url: URL(string: "https://synthetic.invalid/capture")!)
            result.httpMethod = "POST"
            result.httpBodyStream = InputStream(url: file)
            result.setValue(String(bytes.count), forHTTPHeaderField: "Content-Length")
            return result
        }
        do { _ = try await permission.data(for: request(), session: session); fatalError("Denied stream dispatched") }
        catch AIProcessingPermissionError.required {}
        precondition(CaptureStreamProtocol.lock.withLock { CaptureStreamProtocol.calls } == 0)
        permission.setAllowed(true)
        _ = try await permission.data(for: request(), session: session)
        let expected = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        precondition(CaptureStreamProtocol.lock.withLock { CaptureStreamProtocol.receivedBytes } == bytes.count)
        precondition(CaptureStreamProtocol.lock.withLock { CaptureStreamProtocol.receivedDigest } == expected)
        permission.setAllowed(false)
        do { _ = try await permission.data(for: request(), session: session); fatalError("Withdrawn stream dispatched") }
        catch AIProcessingPermissionError.required {}
        precondition(CaptureStreamProtocol.lock.withLock { CaptureStreamProtocol.calls } == 1)
        print("CaptureStreamTests: file stream byte/digest identity and permission denial/withdrawal passed")
    }
}
