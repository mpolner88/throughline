// Synthetic fixtures only. URLProtocol intercepts every request; no provider or backend is contacted.
// This executable deliberately substitutes AuthSessionRefresher to pause authentication.
import Foundation

struct AuthSession { let accessToken = "synthetic" }
actor AuthSessionRefresher {
  static let shared = AuthSessionRefresher()
  var gate: CheckedContinuation<Void, Never>?
  var shouldPause = false
  var entered = false
  func pause() {
    shouldPause = true
    entered = false
  }
  func resume() {
    shouldPause = false
    gate?.resume()
    gate = nil
  }
  func validSession() async throws -> AuthSession? {
    if shouldPause {
      entered = true
      await withCheckedContinuation { gate = $0 }
    }
    return AuthSession()
  }
}
final class Mock: URLProtocol {
  static let lock = NSLock()
  static var count = 0
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    Self.lock.withLock { Self.count += 1 }
    let body: String
    if request.httpMethod == "DELETE" {
      body = "{}"
    } else if request.httpMethod == "GET" {
      body = "{\"recordings\":[],\"count\":0}"
    } else {
      body =
        "{\"id\":\"synthetic\",\"status\":\"uploaded\",\"processing_status\":\"uploaded\",\"has_note\":false}"
    }
    client?.urlProtocol(
      self,
      didReceive: HTTPURLResponse(
        url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!,
      cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: Data(body.utf8))
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
  static var calls: Int { lock.withLock { count } }
}
@main struct Tests {
  static func main() async throws {
    let suite = "throughline.r8.synthetic.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    let permission = AIProcessingPermission(defaults: defaults)
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [Mock.self]
    let session = URLSession(configuration: config)
    defer { session.invalidateAndCancel() }
    let client = UploadClient(
      baseURL: URL(string: "https://synthetic.invalid")!, apiToken: nil, session: session,
      aiPermission: permission)
    let audio = FileManager.default.temporaryDirectory.appendingPathComponent(
      "throughline-permission-\(UUID().uuidString).bin")
    defer { try? FileManager.default.removeItem(at: audio) }
    try Data([0, 1, 2]).write(to: audio)
    let response = try JSONDecoder().decode(
      UploadResponse.self,
      from: Data(
        "{\"id\":\"synthetic\",\"status\":\"uploaded\",\"processing_status\":\"uploaded\",\"has_note\":false}"
          .utf8))
    let note = response.displayNote
    func submit(_ kind: Int) async throws {
      switch kind {
      case 0: _ = try await client.uploadDemoRecording(fileURL: audio, duration: 1, type: .freeform)
      case 1: _ = try await client.uploadRecording(fileURL: audio, duration: 1, type: .freeform)
      default: _ = try await client.saveDemoNote(note, duration: 1)
      }
    }
    for kind in 0...2 {
      do {
        try await submit(kind)
        fatalError("denial bypass")
      } catch AIProcessingPermissionError.required {}
    }
    precondition(Mock.calls == 0)
    print("PASS default denial: all three paths, zero requests")
    permission.setAllowed(true)
    precondition(AIProcessingPermission(defaults: defaults).isAllowed)
    print("PASS persisted grant")
    for kind in 0...2 { try await submit(kind) }
    precondition(Mock.calls == 3)
    print("PASS all three allowed paths decode mocked responses")
    for kind in 1...2 {
      permission.setAllowed(true)
      await AuthSessionRefresher.shared.pause()
      let task = Task { try await submit(kind) }
      while !(await AuthSessionRefresher.shared.entered) { await Task.yield() }
      permission.setAllowed(false)
      await AuthSessionRefresher.shared.resume()
      do {
        try await task.value
        fatalError("withdrawal bypass")
      } catch AIProcessingPermissionError.required {}
    }
    precondition(Mock.calls == 3)
    print("PASS withdrawal during auth await: recording and promotion")
    let notes = try await client.listNotes()
    precondition(notes.isEmpty)
    try await client.deleteRecording(id: "synthetic")
    precondition(Mock.calls == 5)
    print("PASS reading and deletion unaffected")
    permission.setAllowed(true)
    let started = Task {
      try await permission.data(
        for: URLRequest(url: URL(string: "https://synthetic.invalid")!), session: session)
    }
    _ = try await started.value
    permission.setAllowed(false)
    do {
      _ = try await permission.data(
        for: URLRequest(url: URL(string: "https://synthetic.invalid")!), session: session)
      fatalError("withdrawal bypass")
    } catch AIProcessingPermissionError.required {}
    precondition(Mock.calls == 6)
    print("PASS withdrawal preserves dispatched result and blocks next request")
    permission.setAllowed(true)
    await AuthSessionRefresher.shared.pause()
    let cancelled = Task {
      try await client.uploadRecording(fileURL: audio, duration: 1, type: .freeform)
    }
    while !(await AuthSessionRefresher.shared.entered) { await Task.yield() }
    cancelled.cancel()
    await AuthSessionRefresher.shared.resume()
    do {
      _ = try await cancelled.value
      fatalError("cancelled task dispatched")
    } catch {}
    precondition(Mock.calls == 6)
    print("PASS cancellation during auth await sends no request")
  }
}
