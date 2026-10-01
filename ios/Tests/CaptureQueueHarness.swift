// Source-derived coordinator harness: real CaptureQueue/CaptureStore logic with platform,
// auth, recorder and transport adapters. No device API, credential, network or real audio.
import Foundation

protocol ObservableObject {}
@propertyWrapper struct Published<Value> { var wrappedValue: Value; init(wrappedValue: Value) { self.wrappedValue = wrappedValue } }
protocol AVAudioPlayerDelegate: AnyObject {}
final class AVAudioPlayer: @unchecked Sendable {
    weak var delegate: AVAudioPlayerDelegate?
    let duration: Double = 20
    init(contentsOf: URL) throws { _ = try Data(contentsOf: contentsOf) }
    func play() -> Bool { true }
    func stop() {}
    func prepareToPlay() -> Bool { true }
}
final class AVAudioSession {
    enum Category { case playback }
    static func sharedInstance() -> AVAudioSession { AVAudioSession() }
    func setCategory(_ category: Category) throws {}
    func setActive(_ active: Bool) throws {}
}
struct UIImpactFeedbackGenerator { enum Style { case light }; init(style: Style) {}; func impactOccurred() {} }
let kAudioFileInvalidFileError: Int32 = 1
let kAudioFileUnsupportedDataFormatError: Int32 = 2
let kAudioFileUnsupportedFileTypeError: Int32 = 3
struct NWPath: Sendable { enum Status: Sendable { case satisfied, unsatisfied }; let status: Status }
final class NWPathMonitor {
    var pathUpdateHandler: ((NWPath) -> Void)?
    func start(queue: DispatchQueue) {}
    func cancel() {}
}

@MainActor final class AudioRecorder {
    var isRecording = false
    var permissionGranted = true
    var elapsedSeconds = 20
    var onInterrupted: (() -> Void)?
    var onLimitReached: (() -> Void)?
    private var fileURL: URL?
    func requestPermissionIfNeeded() async {}
    func start(limitSeconds: Int?, fileURL: URL?) throws {
        self.fileURL = fileURL
        if let fileURL { try Data(repeating: 1, count: 128).write(to: fileURL) }
        isRecording = true
    }
    func stop() async throws -> URL { isRecording = false; return fileURL! }
}
enum AudioRecorderError: Error { case permissionDenied }
struct AuthUser: Equatable { let id: String }
struct AuthSession: Equatable { let user: AuthUser; let accessToken = "synthetic" }
@MainActor enum AuthSessionStore { static var currentSession: AuthSession? }
@MainActor final class AuthSessionRefresher {
    static let shared = AuthSessionRefresher()
    func validSession() async throws -> AuthSession? { AuthSessionStore.currentSession }
}
enum AuthClientError: Error { case serverError(Int, String) }
@MainActor final class AIProcessingPermission {
    static let shared = AIProcessingPermission()
    var isAllowed = true
}
enum AIProcessingPermissionError: Error { case required }
enum UploadClientError: Error { case serverError(Int, String) }
struct HealthResponse { let authenticated: Bool? }
@MainActor struct UploadClient {
    func health() async throws -> HealthResponse { HealthResponse(authenticated: CaptureHarness.authenticatedHealth) }
    func sendProductEvents(_ events: [ProductEvent], ownerID: String) async throws {
        CaptureHarness.deliveredEvents.append(contentsOf: events)
    }
}
@MainActor enum ProductAnalytics { static func track(_ name: String, properties: [String: String]) {} }
struct RecordingPayload {
    let id: String
    let createdAt: String
    let type: RecordingType?
    let processingStatus: String?
    let transcriptRaw: String?
    let structuredNote: String?
    let currentRevisionID: String?
    let captureID: String?
    func displayNote() -> ThroughlineNote {
        ThroughlineNote(id: id, createdAt: ISO8601DateFormatter.captureDate(createdAt)!, type: type ?? .freeform,
            processingStatus: processingStatus, title: "synthetic", summary: "", transcript: "", mostImportant: [],
            actionItems: [], todos: [], priorities: [], intentions: [], accomplishments: [], tomorrowTodos: [],
            mood: nil, tags: [], people: [], projects: [], centersOfBalance: [], captureID: captureID)
    }
}
struct CaptureWireResponse {
    let captureOutcome: String
    var captureReceipt: CaptureReceipt? = nil
    var ownerDeleted: OwnerDeleted? = nil
    struct OwnerDeleted { let ownerID: String; let captureID: UUID; let deletedAt: String }
}
struct CaptureDeletionResponse { let deletionOutcome: String }
enum CaptureTransportError: Error { case signInRequired, rejected(Int) }
@MainActor struct CaptureTransport {
    func upload(_ capture: CaptureRecord, fileURL: URL, beforeDispatch: () throws -> Void) async throws -> CaptureWireResponse {
        try beforeDispatch()
        return try await CaptureHarness.upload(capture)
    }
    func lookup(_ capture: CaptureRecord) async throws -> CaptureWireResponse { try await CaptureHarness.lookup(capture) }
    func recording(_ id: String, ownerID: String) async throws -> RecordingPayload { try await CaptureHarness.recording(id) }
    func deletion(_ hold: CaptureDeletionHold, dispatch: Bool, beforeDispatch: () throws -> Void = {}) async throws -> CaptureDeletionResponse {
        try beforeDispatch()
        CaptureHarness.deletionCalls.append((hold.token, dispatch))
        return try await CaptureHarness.deletion(hold, dispatch)
    }
}

@MainActor enum CaptureHarness {
    static var directory = FileManager.default.temporaryDirectory
    static var authenticatedHealth = false
    static var deliveredEvents: [ProductEvent] = []
    static var deletionCalls: [(UUID, Bool)] = []
    static var upload: (CaptureRecord) async throws -> CaptureWireResponse = { _ in throw URLError(.notConnectedToInternet) }
    static var lookup: (CaptureRecord) async throws -> CaptureWireResponse = { _ in CaptureWireResponse(captureOutcome: "nothing_held") }
    static var recording: (String) async throws -> RecordingPayload = { _ in throw URLError(.timedOut) }
    static var deletion: (CaptureDeletionHold, Bool) async throws -> CaptureDeletionResponse = { _, _ in CaptureDeletionResponse(deletionOutcome: "pending") }
    static func reset(_ root: URL) throws -> CaptureStore {
        directory = root.appendingPathComponent(UUID().uuidString)
        deliveredEvents = []; deletionCalls = []; authenticatedHealth = false
        AuthSessionStore.currentSession = AuthSession(user: AuthUser(id: "synthetic-owner-a"))
        upload = { _ in throw URLError(.notConnectedToInternet) }
        lookup = { _ in CaptureWireResponse(captureOutcome: "nothing_held") }
        recording = { _ in throw URLError(.timedOut) }
        deletion = { _, _ in CaptureDeletionResponse(deletionOutcome: "pending") }
        return try CaptureStore(directory: directory)
    }
    static func pending(_ store: CaptureStore) throws -> CaptureRecord {
        let record = try store.create(ownerID: "synthetic-owner-a", generation: UUID(), type: .freeform)
        try Data(repeating: 2, count: 128).write(to: store.audioURL(record))
        try store.update(record.id) { record, _ in
            record.state = .waiting; record.byteLength = 128; record.sha256 = String(repeating: "a", count: 64)
        }
        return store.document.captures[0]
    }
    static func receipt(_ record: CaptureRecord) -> CaptureReceipt {
        CaptureReceipt(version: 1, ownerID: record.ownerID, captureID: record.id, recordingID: "rec_synthetic",
            acceptedAt: record.capturedAt, audioSHA256: record.sha256!, audioBytes: record.byteLength!, capturedAt: record.capturedAt)
    }
    static func wait(_ condition: () -> Bool) async throws {
        for _ in 0..<2000 { if condition() { return }; try await Task.sleep(for: .milliseconds(1)) }
        fatalError("Synthetic queue condition timed out")
    }
}

@main struct CaptureQueueHarnessTests {
    @MainActor static func main() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("capture-harness-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try await staleResponseCannotAttach(root)
        try await authRejectionKeepsAudio(root)
        try await pollExhaustionKeepsRepresentation(root)
        try await deletionStopsHeldRecording(root)
        try await explicitDeletionRetryReusesToken(root)
        try await publicHealthCannotClearHold(root)
        print("CaptureQueueHarness: 6 source-derived control-flow groups passed; mocked platform/auth/transport, not device evidence")
    }

    @MainActor static func staleResponseCannotAttach(_ root: URL) async throws {
        let store = try CaptureHarness.reset(root)
        let record = try CaptureHarness.pending(store)
        var continuation: CheckedContinuation<CaptureWireResponse, Error>?
        CaptureHarness.upload = { _ in try await withCheckedThrowingContinuation { continuation = $0 } }
        let queue = CaptureQueue()
        queue.configure(session: AuthSessionStore.currentSession)
        try await CaptureHarness.wait { continuation != nil }
        AuthSessionStore.currentSession = AuthSession(user: AuthUser(id: "synthetic-owner-b"))
        queue.configure(session: AuthSessionStore.currentSession)
        continuation!.resume(returning: CaptureWireResponse(captureOutcome: "accepted", captureReceipt: CaptureHarness.receipt(record)))
        try await Task.sleep(for: .milliseconds(20))
        let restored = try CaptureStore(directory: CaptureHarness.directory)
        precondition(restored.document.captures[0].receipt == nil)
        let audioPath = try restored.audioURL(record).path
        precondition(FileManager.default.fileExists(atPath: audioPath))
        precondition(queue.visibleCaptures.isEmpty && queue.otherOwnerCaptureCount == 1)
        await queue.setForeground(false)
    }

    @MainActor static func authRejectionKeepsAudio(_ root: URL) async throws {
        let store = try CaptureHarness.reset(root)
        let record = try CaptureHarness.pending(store)
        CaptureHarness.upload = { _ in throw CaptureTransportError.signInRequired }
        let queue = CaptureQueue()
        queue.configure(session: AuthSessionStore.currentSession)
        try await CaptureHarness.wait { queue.signInRequired }
        precondition(queue.ownerID == record.ownerID && queue.visibleCaptures.count == 1)
        let audioPath = try store.audioURL(record).path
        precondition(FileManager.default.fileExists(atPath: audioPath))
        await queue.setForeground(false)
    }

    @MainActor static func pollExhaustionKeepsRepresentation(_ root: URL) async throws {
        let store = try CaptureHarness.reset(root)
        let record = try CaptureHarness.pending(store)
        try store.update(record.id) { capture, _ in
            capture.receipt = CaptureHarness.receipt(record); capture.receiptCleanup = true
            capture.state = .saved; capture.pollCount = 9
        }
        var polls = 0
        CaptureHarness.recording = { _ in polls += 1; throw URLError(.timedOut) }
        let queue = CaptureQueue()
        var observed: ThroughlineNote?
        queue.onNote = { observed = $0 }
        queue.configure(session: AuthSessionStore.currentSession)
        try await CaptureHarness.wait { observed != nil }
        precondition(polls == 1 && observed?.id == "rec_synthetic" && observed?.processingStatus == "uploaded")
        precondition(queue.visibleCaptures.isEmpty)
        let saved = try CaptureStore(directory: CaptureHarness.directory)
        precondition(saved.document.captures[0].pollCount == 10)
        await queue.setForeground(false)
    }

    @MainActor static func deletionStopsHeldRecording(_ root: URL) async throws {
        let store = try CaptureHarness.reset(root)
        try store.transaction { $0.holds.append(CaptureDeletionHold(ownerID: "synthetic-owner-a", token: UUID())) }
        var continuation: CheckedContinuation<CaptureDeletionResponse, Error>?
        CaptureHarness.deletion = { _, _ in try await withCheckedThrowingContinuation { continuation = $0 } }
        let queue = CaptureQueue()
        var deleted = false
        queue.onAccountDeleted = { precondition(!queue.recorder.isRecording); deleted = true }
        queue.configure(session: AuthSessionStore.currentSession)
        try await CaptureHarness.wait { continuation != nil }
        await queue.startRecording(type: .freeform, limitSeconds: nil)
        precondition(queue.recorder.isRecording)
        continuation!.resume(returning: CaptureDeletionResponse(deletionOutcome: "deleted"))
        try await CaptureHarness.wait { deleted }
        let restored = try CaptureStore(directory: CaptureHarness.directory)
        precondition(restored.document.captures.isEmpty && restored.document.holds.isEmpty)
        await queue.setForeground(false)
    }

    @MainActor static func explicitDeletionRetryReusesToken(_ root: URL) async throws {
        _ = try CaptureHarness.reset(root)
        let queue = CaptureQueue()
        queue.configure(session: AuthSessionStore.currentSession)
        await queue.setForeground(false)
        // Explicit user action, never automatic deletion after an ambiguous result.
        let first = await queue.deleteAccount()
        precondition(first == .uncertain && queue.deletionPending)
        let token = CaptureHarness.deletionCalls.last!.0
        CaptureHarness.deletion = { _, dispatch in CaptureDeletionResponse(deletionOutcome: dispatch ? "deleted" : "pending") }
        let second = await queue.deleteAccount()
        precondition(second == .deleted)
        precondition(CaptureHarness.deletionCalls.last!.0 == token)
    }

    @MainActor static func publicHealthCannotClearHold(_ root: URL) async throws {
        _ = try CaptureHarness.reset(root)
        CaptureHarness.deletion = { _, _ in CaptureDeletionResponse(deletionOutcome: "refused") }
        let queue = CaptureQueue()
        queue.configure(session: AuthSessionStore.currentSession)
        await queue.setForeground(false)
        let result = await queue.deleteAccount()
        precondition(result == .uncertain && queue.deletionPending)
    }
}
