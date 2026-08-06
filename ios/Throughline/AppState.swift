import Foundation

enum AIProcessingPermission {
    static let storageKey = "throughline.aiProcessingPermissionGranted"
    static let privacyURL = URL(string: "https://mpolner88.github.io/throughline/privacy/")!
}

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
        notes = Self.loadCachedNotes()

        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--throughline-preview-home") {
            session = AuthSession(
                accessToken: "preview",
                refreshToken: "preview",
                expiresAt: Date().addingTimeInterval(3600),
                user: AuthUser(id: "preview", email: "preview@throughline.app")
            )
            route = .home
            return
        }
        #endif

        let restoredSession = AuthSessionStore.currentSession
        session = restoredSession
        let hasFinishedOnboarding = UserDefaults.standard.bool(forKey: Self.hasFinishedOnboardingKey)
        route = restoredSession != nil && hasFinishedOnboarding ? .home : .onboarding
    }

    func setSession(_ session: AuthSession) {
        self.session = session
        AuthSessionStore.save(session)
    }

    func finishOnboarding(with note: ThroughlineNote? = nil) {
        if let note {
            notes.insert(note, at: 0)
        }
        persistNotes()
        UserDefaults.standard.set(true, forKey: Self.hasFinishedOnboardingKey)
        route = .home
    }

    func signOut() {
        session = nil
        AuthSessionStore.clear()
        notes = []
        UserDefaults.standard.removeObject(forKey: Self.notesStorageKey)
        UserDefaults.standard.set(false, forKey: Self.hasFinishedOnboardingKey)
        route = .onboarding
    }

    func finishAccountDeletion() {
        signOut()
    }

    func addUploadedNote(_ note: ThroughlineNote) {
        notes.removeAll { $0.id == note.id }
        notes.insert(note, at: 0)
        persistNotes()
    }

    func replaceNotes(_ notes: [ThroughlineNote]) {
        self.notes = notes.sorted { $0.createdAt > $1.createdAt }
        persistNotes()
    }

    func removeNote(id: String) {
        notes.removeAll { $0.id == id }
        persistNotes()
    }

    private func persistNotes() {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: Self.notesStorageKey)
    }

    private static func loadCachedNotes() -> [ThroughlineNote] {
        guard let data = UserDefaults.standard.data(forKey: notesStorageKey),
              let notes = try? JSONDecoder().decode([ThroughlineNote].self, from: data)
        else {
            return []
        }

        return notes.sorted { $0.createdAt > $1.createdAt }
    }
}
