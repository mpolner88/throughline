// Real refresh coordinator source with an in-memory session store and a gated auth transport.
// No keychain, network, credentials or real accounts are touched.
import Foundation
struct AuthSession: Equatable, Sendable {
    let owner: String
    let accessToken: String
    var refreshToken: String { owner }
    func needsRefresh() -> Bool { true }
}
enum AuthClientError: Error { case serverError(Int, String) }
enum AuthSessionStore {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var session: AuthSession?
    nonisolated(unsafe) private static var revision = UUID()
    static var snapshot: (session: AuthSession?, generation: UUID) { lock.withLock { (session, revision) } }
    static var currentSession: AuthSession? { snapshot.session }
    static func save(_ value: AuthSession) { lock.withLock { session = value; revision = UUID() } }
    static func replace(_ value: AuthSession?, ifGeneration generation: UUID) -> Bool {
        lock.withLock {
            guard revision == generation else { return false }
            session = value; revision = UUID(); return true
        }
    }
}
actor CaptureAuthGate {
    static let shared = CaptureAuthGate()
    enum Mode { case offline, rejected, paused }
    var mode: Mode = .offline
    private var continuation: CheckedContinuation<AuthSession, Error>?
    var entered: Bool { continuation != nil }
    func configure(_ value: Mode) { mode = value; continuation = nil }
    func refresh() async throws -> AuthSession {
        switch mode {
        case .offline: throw URLError(.notConnectedToInternet)
        case .rejected: throw AuthClientError.serverError(401, "synthetic")
        case .paused: return try await withCheckedThrowingContinuation { continuation = $0 }
        }
    }
    func complete(_ session: AuthSession) { continuation?.resume(returning: session); continuation = nil }
    func reject() { continuation?.resume(throwing: AuthClientError.serverError(401, "synthetic")); continuation = nil }
}
struct AuthClient: Sendable {
    func refreshSession(refreshToken: String) async throws -> AuthSession { try await CaptureAuthGate.shared.refresh() }
}
@main struct CaptureAuthHarnessTests {
    static func main() async throws {
        let a = AuthSession(owner: "synthetic-a", accessToken: "old")
        let b = AuthSession(owner: "synthetic-b", accessToken: "current")
        AuthSessionStore.save(a)
        await CaptureAuthGate.shared.configure(.offline)
        do { _ = try await AuthSessionRefresher.shared.validSession(); fatalError("Expected offline") } catch {}
        precondition(AuthSessionStore.currentSession == a)
        await CaptureAuthGate.shared.configure(.rejected)
        do { _ = try await AuthSessionRefresher.shared.validSession(); fatalError("Expected rejection") } catch {}
        precondition(AuthSessionStore.currentSession == nil)
        AuthSessionStore.save(a)
        await CaptureAuthGate.shared.configure(.paused)
        let oldSuccess = Task { try await AuthSessionRefresher.shared.validSession() }
        while !(await CaptureAuthGate.shared.entered) { await Task.yield() }
        AuthSessionStore.save(b)
        await CaptureAuthGate.shared.complete(AuthSession(owner: a.owner, accessToken: "stale-refreshed"))
        do { _ = try await oldSuccess.value; fatalError("Expected stale cancellation") } catch {}
        precondition(AuthSessionStore.currentSession == b)
        AuthSessionStore.save(a)
        await CaptureAuthGate.shared.configure(.paused)
        let oldFailure = Task { try await AuthSessionRefresher.shared.validSession() }
        while !(await CaptureAuthGate.shared.entered) { await Task.yield() }
        AuthSessionStore.save(b)
        await CaptureAuthGate.shared.reject()
        do { _ = try await oldFailure.value; fatalError("Expected stale rejection") } catch {}
        precondition(AuthSessionStore.currentSession == b)
        print("CaptureAuthHarness: offline retention, rejection and stale success/error isolation passed; mocked transport/store")
    }
}
