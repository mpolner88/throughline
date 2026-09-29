import CryptoKit
import Foundation

@MainActor
final class AppState: ObservableObject {
    private static let notesStorageKey = "throughline.cachedNotes"
    private static let hasFinishedOnboardingKey = "throughline.hasFinishedOnboarding"

    enum Route: Equatable {
        case onboarding
        case home
    }

    @Published var route: Route
    @Published var hasConnectedAgent = false
    @Published var notes: [ThroughlineNote]
    @Published private(set) var session: AuthSession?
    private(set) var accountGeneration = UUID()
    let captureQueue = CaptureQueue()

    var isSignedIn: Bool {
        session != nil
    }

    var todaysMorningNote: ThroughlineNote? {
        notes.first { $0.type == .morning }
    }

    var todaysEveningNote: ThroughlineNote? {
        notes.first { $0.type == .evening }
    }

    var carriedForwardItems: [String] {
        notes.flatMap(\.tomorrowTodos)
    }

    var latestNotes: [ThroughlineNote] {
        notes.sorted { $0.createdAt > $1.createdAt }
    }

    init() {
        notes = []

        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--throughline-preview-home") {
            if ProcessInfo.processInfo.arguments.contains("--throughline-preview-populated-home") {
                notes = [.sample]
            } else if ProcessInfo.processInfo.arguments.contains("--throughline-preview-empty-home") {
                notes = []
            }
            session = AuthSession(
                accessToken: "preview",
                refreshToken: "preview",
                expiresAt: Date().addingTimeInterval(3600),
                user: AuthUser(id: "preview", email: "preview@throughline.app")
            )
            route = .home
            bindCaptureQueue()
            let arguments = ProcessInfo.processInfo.arguments
            if let flag = arguments.first(where: { $0.hasPrefix("--throughline-preview-capture=") }),
               let state = CaptureState(rawValue: String(flag.split(separator: "=", maxSplits: 1).last!)) {
                captureQueue.seedPreview(state: state,
                    count: arguments.contains("--throughline-preview-capture-many") ? 5 : 1,
                    unknown: arguments.contains("--throughline-preview-capture-unknown"),
                    offline: arguments.contains("--throughline-preview-capture-offline"),
                    held: arguments.contains("--throughline-preview-capture-held"),
                    otherAccount: arguments.contains("--throughline-preview-capture-other"),
                    mixed: arguments.contains("--throughline-preview-capture-mixed"))
            }
            return
        }
        #endif

        let restoredSession = AuthSessionStore.currentSession
        session = restoredSession
        notes = Self.loadCachedNotes(ownerID: restoredSession?.user.id)
        // Preserve the unbound legacy cache untouched; never assign it to an inferred owner.
        let hasFinishedOnboarding = UserDefaults.standard.bool(forKey: Self.hasFinishedOnboardingKey)
        route = restoredSession != nil && hasFinishedOnboarding ? .home : .onboarding
        bindCaptureQueue()
    }

    private func bindCaptureQueue() {
        captureQueue.onNote = { [weak self] note in self?.addUploadedNote(note) }
        captureQueue.onAccountDeleted = { [weak self] in self?.finishAccountDeletion() }
        captureQueue.onSessionRefreshed = { [weak self] refreshed in
            guard self?.session?.user.id == refreshed.user.id else { return }
            self?.session = refreshed
        }
        captureQueue.configure(session: session)
    }

    func setSession(_ session: AuthSession) {
        let changedOwner = self.session?.user.id != session.user.id
        accountGeneration = UUID()
        self.session = session
        AuthSessionStore.save(session)
        if changedOwner { notes = Self.loadCachedNotes(ownerID: session.user.id) }
        captureQueue.configure(session: session)
    }

    func finishOnboarding(with note: ThroughlineNote? = nil) {
        if let note {
            notes.insert(note, at: 0)
        }
        persistNotes()
        UserDefaults.standard.set(true, forKey: Self.hasFinishedOnboardingKey)
        route = .home
    }

    func signOut() throws {
        try captureQueue.prepareSignOut()
        clearSession()
    }

    private func clearSession() {
        accountGeneration = UUID()
        session = nil
        AuthSessionStore.clear()
        notes = []
        // Owner-bound and legacy caches are preserved; unsigned views never load them.
        UserDefaults.standard.set(false, forKey: Self.hasFinishedOnboardingKey)
        captureQueue.configure(session: nil)
        route = .onboarding
    }

    func finishAccountDeletion() {
        if let ownerID = session?.user.id {
            UserDefaults.standard.removeObject(forKey: Self.cacheKey(ownerID: ownerID))
        }
        clearSession()
    }

    func addUploadedNote(_ note: ThroughlineNote) {
        notes.removeAll { $0.id == note.id }
        notes.insert(note, at: 0)
        persistNotes()
    }

    func replaceNotes(_ notes: [ThroughlineNote]) {
        let localOnlyNotes = self.notes.filter { !$0.id.hasPrefix("rec_") }
        let remoteIDs = Set(notes.map(\.id))
        self.notes = (notes + localOnlyNotes.filter { !remoteIDs.contains($0.id) })
            .sorted { $0.createdAt > $1.createdAt }
        persistNotes()
    }

    func removeNote(id: String) {
        notes.removeAll { $0.id == id }
        persistNotes()
    }

    private func persistNotes() {
        guard let ownerID = session?.user.id, let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: Self.cacheKey(ownerID: ownerID))
    }

    private static func cacheKey(ownerID: String) -> String {
        let digest = SHA256.hash(data: Data(ownerID.utf8)).map { String(format: "%02x", $0) }.joined()
        return "throughline.cachedNotes.owner.\(digest)"
    }

    private static func loadCachedNotes(ownerID: String?) -> [ThroughlineNote] {
        guard let ownerID, let data = UserDefaults.standard.data(forKey: cacheKey(ownerID: ownerID)),
              let notes = try? JSONDecoder().decode([ThroughlineNote].self, from: data)
        else {
            return []
        }

        return notes.sorted { $0.createdAt > $1.createdAt }
    }
}
