import Foundation

/// Installation-wide, default-denied permission. Keep the original key across upgrades.
final class AIProcessingPermission: @unchecked Sendable {
    static let storageKey = "throughline.aiProcessingPermissionGranted"
    static let privacyURL = URL(string: "https://mpolner88.github.io/throughline/privacy/")!
    static let shared = AIProcessingPermission(defaults: .standard)
    private let defaults: UserDefaults
    private let lock = NSLock()

    init(defaults: UserDefaults) { self.defaults = defaults }

    var isAllowed: Bool { lock.withLock { defaults.bool(forKey: Self.storageKey) } }

    func setAllowed(_ allowed: Bool) {
        lock.withLock { defaults.set(allowed, forKey: Self.storageKey) }
    }

    // The last permission check and task initiation share the withdrawal lock.
    // Auth refresh/request preparation must finish before entering this boundary.
    // Withdrawing stops future dispatch; it cannot recall work already dispatched.
    func data(for request: URLRequest, session: URLSession = .shared) async throws -> (Data, URLResponse) {
        let cancellation = PendingAIRequest()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                lock.withLock {
                    guard defaults.bool(forKey: Self.storageKey) else {
                        continuation.resume(throwing: AIProcessingPermissionError.required)
                        return
                    }
                    let task = session.dataTask(with: request) { data, response, error in
                        if let error { continuation.resume(throwing: error) }
                        else if let data, let response { continuation.resume(returning: (data, response)) }
                        else { continuation.resume(throwing: URLError(.badServerResponse)) }
                    }
                    cancellation.start(task)
                }
            }
        } onCancel: {
            cancellation.cancel()
        }
    }
}

enum AIProcessingPermissionError: LocalizedError {
    case required
    var errorDescription: String? {
        "AI processing is not allowed. Review your choice before sending a recording or saving a demo note."
    }
}

private final class PendingAIRequest: @unchecked Sendable {
    private let lock = NSLock()
    private var task: URLSessionDataTask?
    private var cancelled = false

    func start(_ task: URLSessionDataTask) {
        lock.withLock {
            self.task = task
            if cancelled { task.cancel() }
            task.resume()
        }
    }

    func cancel() {
        lock.withLock {
            cancelled = true
            task?.cancel()
        }
    }
}
