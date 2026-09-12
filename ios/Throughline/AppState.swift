import Foundation

enum AIProcessingPermission {
    static let storageKey = "throughline.aiProcessingPermissionGranted"
    static let privacyURL = URL(string: "https://mpolner88.github.io/throughline/privacy/")!
}

@MainActor
final class AppState: ObservableObject {
    private static let notesStorageKey = "throughline.cachedNotes"
    private static let taskListStorageKey = "throughline.cachedTaskList"
    private static let hasFinishedOnboardingKey = "throughline.hasFinishedOnboarding"

    enum Route: Equatable {
        case onboarding
        case home
    }

    @Published var route: Route
    @Published var hasConnectedAgent = false
    @Published var notes: [ThroughlineNote]
    @Published var taskList: TaskListResponse?
    @Published var selectedBucket: TaskBucket = .today
    @Published var taskListIsStale = false
    @Published private(set) var session: AuthSession?

    var isSignedIn: Bool {
        session != nil
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
            restoreCachedTaskList()
            return
        }
        #endif

        let restoredSession = AuthSessionStore.currentSession
        session = restoredSession
        let hasFinishedOnboarding = UserDefaults.standard.bool(forKey: Self.hasFinishedOnboardingKey)
        route = restoredSession != nil && hasFinishedOnboarding ? .home : .onboarding
        restoreCachedTaskList()
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
        taskList = nil
        taskListIsStale = false
        selectedBucket = .today
        UserDefaults.standard.removeObject(forKey: Self.notesStorageKey)
        UserDefaults.standard.removeObject(forKey: Self.taskListStorageKey)
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

    func applyTaskList(_ list: TaskListResponse) {
        taskList = list
        taskListIsStale = false
        persistTaskList()
    }

    // Moves the item between its bucket and the done group before the server
    // confirms, so the row reacts on tap. The next applyTaskList replaces it.
    func markTask(_ task: TaskItem, completed: Bool) {
        guard var list = taskList else { return }

        var updated = task
        updated.status = completed ? "completed" : "open"
        updated.completedAt = completed ? Self.isoTimestamp() : nil

        list.today.removeAll { $0.id == task.id }
        list.thisWeek.removeAll { $0.id == task.id }
        list.later.removeAll { $0.id == task.id }
        list.done.removeAll { $0.id == task.id }

        if completed {
            list.done.insert(updated, at: 0)
        } else {
            switch updated.bucket {
            case .today:
                list.today = TaskListResponse.sorted(list.today + [updated], in: .today)
            case .thisWeek:
                list.thisWeek = TaskListResponse.sorted(list.thisWeek + [updated], in: .thisWeek)
            case .later:
                list.later = TaskListResponse.sorted(list.later + [updated], in: .later)
            }
        }

        list.counts = TaskCounts(
            today: list.today.count,
            thisWeek: list.thisWeek.count,
            later: list.later.count
        )
        taskList = list
        persistTaskList()
    }

    // Runs after every stored property is set, so the @Published setters are safe.
    private func restoreCachedTaskList() {
        guard let cachedList = Self.loadCachedTaskList() else { return }

        let today = TaskListResponse.localDate()
        if cachedList.date == today {
            taskList = cachedList
        } else {
            taskList = cachedList.rederived(for: today)
            taskListIsStale = true
        }
    }

    private func persistTaskList() {
        guard let taskList, let data = try? JSONEncoder().encode(taskList) else {
            UserDefaults.standard.removeObject(forKey: Self.taskListStorageKey)
            return
        }
        UserDefaults.standard.set(data, forKey: Self.taskListStorageKey)
    }

    private static func loadCachedTaskList() -> TaskListResponse? {
        guard let data = UserDefaults.standard.data(forKey: taskListStorageKey) else { return nil }
        return try? JSONDecoder().decode(TaskListResponse.self, from: data)
    }

    private static func isoTimestamp() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
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
