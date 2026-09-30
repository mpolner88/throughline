import Foundation

// CLI harness substitutes only the existing app/auth payload dependencies. The task models,
// projection, store, transport and coordinator below are the actual production files.
struct BackendConfiguration { static let currentBaseURL = URL(string: "https://synthetic.invalid/api")! }
struct HarnessUser { var id: String }
struct HarnessSession { var user: HarnessUser; var accessToken: String }
@MainActor enum AuthSessionStore {
    static var generation = UUID()
    static var currentSession: HarnessSession?
    static var snapshot: (session: HarnessSession?, generation: UUID) { (currentSession, generation) }
    static func replace(_ value: HarnessSession?, ifGeneration: UUID) -> Bool {
        guard generation == ifGeneration else { return false }
        currentSession = value; generation = UUID(); return true
    }
}
@MainActor struct AuthSessionRefresher {
    static let shared = Self()
    func validSession() async throws -> HarnessSession? { AuthSessionStore.currentSession }
}
struct RecordingPayload: Decodable {
    let note: ThroughlineNote
    var id: String { note.id }
    func displayNote() -> ThroughlineNote { note }
}

@MainActor final class FakeTaskTransport: TaskTransporting {
    var response: TaskListResponse
    var note: TaskNoteEnvelope
    var requests: [TaskMutationRequest] = []
    var edits: [TaskEditRequest] = []
    var owners: [String] = []
    var listCalls = 0
    var loseMutationResponse = false
    var loseEditResponse = false
    var failDetail = false
    var rejectMutation = false
    var requireSignIn = false
    var pauseMutation: CheckedContinuation<Void, Never>?
    var shouldPauseMutation = false
    var mutationReceipts: [String: TaskMutationResponse] = [:]
    var editReceipts: [String: TaskNoteEnvelope] = [:]
    init(tasks: [TaskOccurrence], note: ThroughlineNote, version: Int64 = 1) {
        response = TaskListResponse(contractVersion: 1, cutoverAt: "2026-09-29T00:00:00Z", snapshotVersion: version, tasks: tasks)
        self.note = TaskNoteEnvelope(note: note, taskRevision: 1, snapshotVersion: version, tasks: tasks)
    }
    func list(ownerID: String) async throws -> TaskListResponse { owners.append(ownerID); listCalls += 1; return response }
    func detail(recordingID: String, ownerID: String) async throws -> TaskNoteEnvelope {
        owners.append(ownerID)
        if failDetail { throw URLError(.timedOut) }
        return note
    }
    func mutate(occurrenceID: String, request: TaskMutationRequest, ownerID: String, beforeDispatch: () throws -> Void) async throws -> TaskMutationResponse {
        try beforeDispatch(); owners.append(ownerID); requests.append(request)
        if shouldPauseMutation { await withCheckedContinuation { pauseMutation = $0 } }
        if requireSignIn { throw TaskSyncError.signedOut }
        if let receipt = mutationReceipts[request.mutationID] { return receipt }
        if rejectMutation { throw TaskSyncError.conflict }
        guard let index = response.tasks.firstIndex(where: { $0.id == occurrenceID }) else { throw TaskSyncError.removed }
        guard response.tasks[index].version == request.expectedVersion else { throw TaskSyncError.conflict }
        let command = TaskPendingCommand(id: request.mutationID, recordingID: response.tasks[index].recordingID,
            occurrenceID: occurrenceID, request: request)
        var updated = RunningListProjection.overlay([response.tasks[index]], commands: [command])[0]
        updated.version += 1
        response.tasks[index] = updated; response.snapshotVersion += 1
        note.tasks = response.tasks; note.snapshotVersion = response.snapshotVersion; note.taskRevision += 1
        let receipt = TaskMutationResponse(mutationID: request.mutationID, snapshotVersion: response.snapshotVersion, task: updated)
        mutationReceipts[request.mutationID] = receipt
        if loseMutationResponse { loseMutationResponse = false; throw URLError(.timedOut) }
        return receipt
    }
    func edit(recordingID: String, request: TaskEditRequest, ownerID: String, beforeDispatch: () throws -> Void) async throws -> TaskNoteEnvelope {
        try beforeDispatch(); owners.append(ownerID); edits.append(request)
        if let result = editReceipts[request.mutationID] { return result }
        guard note.taskRevision == request.expectedTaskRevision else { throw TaskSyncError.conflict }
        note.note.title = request.title; note.note.summary = request.summary; note.note.transcript = request.transcript
        note.taskRevision += 1; response.snapshotVersion += 1; note.snapshotVersion = response.snapshotVersion
        note.mutationID = request.mutationID
        var tasks: [TaskOccurrence] = []
        for (index, item) in request.todos.enumerated() {
            var task = response.tasks.first { $0.id == item.id } ?? fixtureTask(item.clientItemID ?? "new", order: index)
            task.text = item.text; task.sourceOrder = index; task.version += 1
            tasks.append(task)
        }
        note.tasks = tasks; response.tasks = tasks
        editReceipts[request.mutationID] = note
        if loseEditResponse { loseEditResponse = false; throw URLError(.timedOut) }
        return note
    }
}

func fixtureDate(_ value: String = "2026-09-30T19:00:00Z") -> Date { TaskDates.instant(value)! }
func fixtureTask(_ id: String = "task-a", order: Int = 0, date: String? = nil, earlier: Bool = false) -> TaskOccurrence {
    TaskOccurrence(id: id, recordingID: "rec_synthetic", version: 1, sourceOrder: order, text: "Synthetic repeated task",
        status: "open", due: date, createdAt: "2026-09-30T19:00:00Z", originLocalDate: "2026-09-30",
        sourceCreatedAt: "2026-09-30T19:00:00Z", sourceLocalDate: "2026-09-30", sourceTimezone: "America/Los_Angeles",
        sourceTitle: "Synthetic note", isEarlier: earlier)
}
func fixtureNote() -> ThroughlineNote {
    ThroughlineNote(id: "rec_synthetic", createdAt: fixtureDate(), type: .freeform, title: "Synthetic note", summary: "",
        transcript: "", todos: [], priorities: [], intentions: [], accomplishments: [], tomorrowTodos: [], mood: nil,
        tags: [], people: [], projects: [], centersOfBalance: [])
}
func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fatalError(message) }
}

@main struct TaskCoordinatorTests {
    @MainActor static func main() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("running-list-tests-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try projection()
        try models()
        try storeIntegrity(root.appendingPathComponent("integrity"))
        try await commands(root.appendingPathComponent("commands"))
        try await editors(root.appendingPathComponent("editors"))
        try await staleEditorReceipt(root.appendingPathComponent("stale-editor"))
        try await accountIsolation(root.appendingPathComponent("owners"))
        try await heldOwnerAndRecovery(root.appendingPathComponent("held"))
        try await transportChecks()
        try await previewEditing(root.appendingPathComponent("preview"))
        print("RunningListTests: 10 groups passed (calendar, identity, atomic store, replay, editor, stale editor receipt, owner/deletion, transport, preview editor, held owner/recovery)")
    }
    @MainActor static func projection() throws {
        let la = TimeZone(identifier: "America/Los_Angeles")!
        let sunday = fixtureDate("2026-10-04T19:00:00Z")
        let mondayTask = fixtureTask(date: "2026-10-05")
        let sundayList = RunningListProjection.project(occurrences: [mondayTask], now: sunday, timeZone: la)
        expect(sundayList.later.open.count == 1 && sundayList.later.open[0].marker == "tomorrow", "Sunday tomorrow is later")
        let monday = fixtureDate("2026-10-05T19:00:00Z")
        expect(RunningListProjection.project(occurrences: [mondayTask], now: monday, timeZone: la).today.open.count == 1, "Monday becomes today")
        let weekday = RunningListProjection.project(occurrences: [fixtureTask(date: "2026-10-02")], now: fixtureDate(), timeZone: la)
        expect(weekday.thisWeek.open[0].marker == TaskDates.weekday("2026-10-02"), "Future week marker is weekday")
        var moved = mondayTask; moved.placementOverride = .thisWeek; moved.placementAnchorDate = "2026-09-30"
        expect(RunningListProjection.project(occurrences: [moved], now: monday, timeZone: la).thisWeek.open.count == 1, "Manual week remains after Sunday")
        var old = fixtureTask(earlier: true)
        expect(RunningListProjection.project(occurrences: [old], now: monday, timeZone: la).earlier.count == 1, "Old provenance is separate")
        old.status = "completed"; old.completedAt = TaskDates.iso(monday); old.completedPlacement = .later
        let done = RunningListProjection.project(occurrences: [old], now: monday, timeZone: la)
        expect(done.later.doneToday.count == 1 && done.later.doneToday[0].marker == nil && done.later.openCount == 0, "Done earlier is later with no marker/count")
        expect(RunningListProjection.project(occurrences: [old], now: fixtureDate("2026-10-06T08:00:00Z"), timeZone: la).later.doneToday.isEmpty, "Done leaves at midnight")
        var first = fixtureTask("first"); first.status = "completed"; first.completedAt = "2026-10-05T18:00:00Z"
        var second = fixtureTask("second"); second.status = "completed"; second.completedAt = "2026-10-05T18:00:00.500+00:00"
        var equal = fixtureTask("equal"); equal.status = "completed"; equal.completedAt = "2026-10-05T11:00:00-07:00"
        let mixed = RunningListProjection.project(occurrences: [second, first, equal], now: monday, timeZone: la)
        expect(mixed.today.doneToday.map(\.id) == ["equal", "first", "second"], "Done orders by instant with stable identity ties")
        old.status = "open"; old.completedAt = nil
        expect(RunningListProjection.project(occurrences: [old], now: monday, timeZone: la).earlier.count == 1, "Undo retains earlier provenance")
        expect(TaskDates.dateOnly("2024-02-29") != nil && TaskDates.dateOnly("2025-02-29") == nil && TaskDates.dateOnly("2026-13-01") == nil, "Strict leap/calendar validation")
        let spring = fixtureDate("2026-03-08T08:00:00Z")
        let fall = fixtureDate("2026-11-01T07:00:00Z")
        expect(TaskDates.nextMidnight(after: spring, zone: la).timeIntervalSince(spring) == 23 * 3600, "Spring day has 23 hours")
        expect(TaskDates.nextMidnight(after: fall, zone: la).timeIntervalSince(fall) == 25 * 3600, "Fall day has 25 hours")
        var invalid = fixtureTask(date: "tomorrow"); invalid.forDate = "2026-10-02"
        expect(RunningListProjection.placement(invalid, now: fixtureDate(), timeZone: la) == .thisWeek, "Invalid due falls back to valid for_date")
        invalid.due = "2026-09-30"
        expect(RunningListProjection.placement(invalid, now: fixtureDate(), timeZone: la) == .today, "Due precedes for_date")
        let travel = fixtureTask(date: "2026-10-01")
        expect(RunningListProjection.placement(travel, now: fixtureDate(), timeZone: TimeZone(identifier: "Asia/Tokyo")!) == .today, "Civil due date survives travel")
        expect(RunningListProjection.placement(travel, now: fixtureDate(), timeZone: la) == .thisWeek, "Same instant is prior LA day")
        var delayed = fixtureTask(); delayed.originLocalDate = "2026-09-28"
        expect(RunningListProjection.project(occurrences: [delayed], now: fixtureDate(), timeZone: la).today.open[0].marker?.hasPrefix("from ") == true, "Delayed upload retains captured civil day")
        let year = fixtureDate("2026-12-31T20:00:00Z")
        expect(TaskDates.sunday(now: year, zone: la) == "2027-01-03", "Week crosses year")
    }
    static func models() throws {
        let raw = Data("{\"text\":\"Synthetic\"}".utf8)
        let a = try JSONDecoder().decode(Todo.self, from: raw), b = try JSONDecoder().decode(Todo.self, from: raw)
        expect(a.id.isEmpty && a.id == b.id, "Missing identity is not regenerated")
        var note = fixtureNote(); note.taskContractVersion = 1; note.taskRevision = 1
        note.todos = [Todo(id: "a", text: "Same", priority: nil, due: nil, forDate: nil, context: nil), Todo(id: "b", text: "Same", priority: nil, due: nil, forDate: nil, context: nil)]
        note.mostImportant = ["Unrelated prose"]
        expect(note.displayImportantActionItems.map(\.occurrenceID) == ["a", "b"], "Each real todo has separate action authority")
        let draft = NoteEditDraft(note: note)
        expect(draft.todoRows.count == 2 && draft.todos == ["Same", "Same"], "Editor preserves repeated words")
        note.taskContractVersion = nil
        expect(note.displayImportantActionItems.allSatisfy { $0.occurrenceID == nil }, "Legacy unknown tasks are read-only")
        let roundtrip = try JSONDecoder().decode(TaskOccurrence.self, from: JSONEncoder().encode(fixtureTask()))
        expect(roundtrip == fixtureTask(), "DTO round trip")
    }
    @MainActor static func storeIntegrity(_ root: URL) throws {
        let store = try TaskStore(directory: root)
        let response = TaskListResponse(contractVersion: 1, cutoverAt: "2026-09-30T00:00:00Z", snapshotVersion: 2, tasks: [fixtureTask()])
        try store.transaction(ownerID: "synthetic-a") { try TaskStore.apply(response, to: &$0) }
        let failing = try TaskStore(directory: root, write: { _, _ in throw TaskSyncError.unavailable })
        do { try failing.transaction(ownerID: "synthetic-a") { $0.tasks = [] }; fatalError("Expected write failure") } catch { }
        expect(failing.owner("synthetic-a").tasks.count == 1, "Failed write never publishes candidate")
        let restored = try TaskStore(directory: root)
        expect(restored.owner("synthetic-a").hasSnapshot && restored.owner("synthetic-b").tasks.isEmpty, "Durable owner partition")
        var deleted = response; deleted.snapshotVersion = 4; deleted.tasks = []
        try restored.transaction(ownerID: "synthetic-a") { try TaskStore.apply(deleted, to: &$0) }
        try restored.transaction(ownerID: "synthetic-a") { state in
            let applied = try TaskStore.apply(TaskMutationResponse(mutationID: "old", snapshotVersion: 3, task: fixtureTask()), to: &state)
            expect(!applied && state.tasks.isEmpty, "Old receipt cannot resurrect deleted task")
        }
        do { try restored.transaction(ownerID: "synthetic-a") { try TaskStore.apply(response, to: &$0) }; fatalError("Expected old snapshot rejection") } catch { }
        try restored.deleteOwner("synthetic-a")
        let afterDeletion = try TaskStore(directory: root)
        expect(afterDeletion.isDeleted("synthetic-a"), "Account deletion survives relaunch")
    }
    @MainActor static func commands(_ root: URL) async throws {
        let store = try TaskStore(directory: root)
        let fake = FakeTaskTransport(tasks: [fixtureTask(), fixtureTask("task-b", order: 1)], note: fixtureNote())
        let coordinator = TaskCoordinator(store: store, transport: fake, now: { fixtureDate() }, monitorConnectivity: false)
        coordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await coordinator.refresh()
        fake.loseMutationResponse = true
        try coordinator.setCompleted(id: "task-a", completed: true, from: .today)
        await coordinator.refresh()
        expect(store.owner("synthetic-a").commands.count == 1 && store.owner("synthetic-a").commands[0].dispatched, "Unknown response remains durable")
        expect(coordinator.occurrence(id: "task-a")!.isCompleted && !coordinator.occurrence(id: "task-b")!.isCompleted, "Optimism changes one duplicate only")
        await coordinator.setForeground(false)
        let restored = try TaskStore(directory: root)
        let relaunched = TaskCoordinator(store: restored, transport: fake, now: { fixtureDate() }, monitorConnectivity: false)
        relaunched.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await relaunched.refresh()
        expect(fake.requests.count >= 2 && fake.requests[0] == fake.requests[1], "Exact command body and UUID replay")
        expect(restored.owner("synthetic-a").commands.isEmpty, "Replay acknowledged once")
        await relaunched.setForeground(false)
        try relaunched.setCompleted(id: "task-a", completed: false, from: .today)
        try relaunched.move(id: "task-a", to: .later, now: fixtureDate(), timeZone: .current)
        await relaunched.setForeground(true)
        expect(relaunched.occurrence(id: "task-a")!.placementOverride == .later && !relaunched.occurrence(id: "task-a")!.isCompleted, "Reopen then move serialize with advancing version")
        await relaunched.setForeground(false)
        try relaunched.setCompleted(id: "task-b", completed: true, from: .today)
        fake.response.tasks[1].version += 1 // Another client's edit after this tap.
        await relaunched.setForeground(true)
        expect(!relaunched.occurrence(id: "task-b")!.isCompleted, "Remote version conflict removes failed optimism")
        expect(fake.requests.last?.expectedVersion == 1, "Never rebase a first command onto an unrelated remote edit")
        try relaunched.recordingDeleted("rec_synthetic")
        expect(relaunched.occurrences.isEmpty && restored.owner("synthetic-a").commands.isEmpty, "Source deletion removes pending work")
        await relaunched.refresh()
        expect(relaunched.occurrences.isEmpty, "A stale remote list cannot undo local confirmed deletion")
        await relaunched.setForeground(false)
    }
    @MainActor static func editors(_ root: URL) async throws {
        let store = try TaskStore(directory: root)
        let fake = FakeTaskTransport(tasks: [fixtureTask()], note: fixtureNote())
        let coordinator = TaskCoordinator(store: store, transport: fake, now: { fixtureDate() }, monitorConnectivity: false)
        coordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await coordinator.refresh()
        var draft = try await coordinator.prepareEditor(recordingID: "rec_synthetic")
        draft.todoRows[0].text = "Synthetic renamed"
        draft.todoRows.append(TodoEditRow(newText: "Synthetic renamed"))
        fake.loseEditResponse = true
        do { _ = try await coordinator.saveEditor(draft); fatalError("Expected unknown save") }
        catch { expect(error as? TaskSyncError == .savePending, "Unknown editor error") }
        expect(coordinator.pendingEditor(recordingID: "rec_synthetic")?.isFrozen == true, "Unknown editor frozen")
        coordinator.setAccountDeletionPending(true)
        expect(coordinator.occurrences.isEmpty && coordinator.allOccurrenceIDs.isEmpty && !coordinator.hasLoadedSnapshot, "Held owner hides published tasks")
        expect(coordinator.snapshot(now: fixtureDate(), timeZone: .current).today.open.isEmpty, "Held owner cannot project cache")
        expect(coordinator.pendingEditor(recordingID: "rec_synthetic") == nil && coordinator.decorated(fixtureNote()).todos.isEmpty, "Held owner cannot access pending draft or decoration")
        do { _ = try await coordinator.prepareEditor(recordingID: "rec_synthetic"); fatalError("Expected held editor") }
        catch { expect(error as? TaskSyncError == .deletionPending, "Held frozen editor is inaccessible") }
        do { _ = try await coordinator.saveEditor(draft); fatalError("Expected held save") }
        catch { expect(error as? TaskSyncError == .deletionPending, "Held save cannot dispatch") }
        coordinator.setAccountDeletionPending(false)
        let reopened = try await coordinator.prepareEditor(recordingID: "rec_synthetic")
        expect(reopened == draft, "Reopen returns frozen draft")
        await coordinator.setForeground(false)
        let restored = try TaskStore(directory: root)
        let relaunch = TaskCoordinator(store: restored, transport: fake, now: { fixtureDate() }, monitorConnectivity: false)
        relaunch.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await relaunch.refresh()
        expect(fake.edits.count == 1 && relaunch.pendingEditor(recordingID: "rec_synthetic")?.isFrozen == true, "Relaunch preserves explicit-only edit retry")
        let frozen = try await relaunch.prepareEditor(recordingID: "rec_synthetic")
        _ = try await relaunch.saveEditor(frozen)
        expect(fake.edits.count == 2 && fake.edits[0] == fake.edits[1], "Editor relaunch replays same frozen mutation")
        expect(relaunch.pendingEditor(recordingID: "rec_synthetic") == nil, "Editor replay settled")
        _ = try await relaunch.saveEditor(draft)
        expect(fake.edits.count == 2, "Late Save tap recognizes already-confirmed draft")
        var next = try await relaunch.prepareEditor(recordingID: "rec_synthetic")
        next.title = "Synthetic changed title"
        fake.note.taskRevision += 1
        do { _ = try await relaunch.saveEditor(next); fatalError("Expected conflict") }
        catch { expect(error as? TaskSyncError == .conflict, "Stale editor applies nothing") }
        expect(relaunch.pendingEditor(recordingID: "rec_synthetic") == nil, "Conflict releases frozen state")
        await relaunch.setForeground(false)
    }
    @MainActor static func staleEditorReceipt(_ root: URL) async throws {
        let store = try TaskStore(directory: root)
        let fake = FakeTaskTransport(tasks: [fixtureTask()], note: fixtureNote())
        let coordinator = TaskCoordinator(store: store, transport: fake, monitorConnectivity: false)
        coordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await coordinator.refresh()
        var draft = try await coordinator.prepareEditor(recordingID: "rec_synthetic")
        draft.title = "Synthetic saved title"
        draft.summary = "Synthetic saved summary"
        draft.todoRows.append(TodoEditRow(newText: "Synthetic added task"))
        fake.loseEditResponse = true
        do { _ = try await coordinator.saveEditor(draft); fatalError("Expected unknown save") }
        catch { expect(error as? TaskSyncError == .savePending, "Lost editor receipt remains pending") }
        let frozen = coordinator.pendingEditor(recordingID: "rec_synthetic")!
        // An unrelated owner change advances the snapshot beyond the immutable receipt.
        fake.response.snapshotVersion += 1
        fake.note.snapshotVersion = fake.response.snapshotVersion
        await coordinator.refresh()
        fake.failDetail = true
        do { _ = try await coordinator.saveEditor(draft); fatalError("Expected pending fresh detail") }
        catch { expect(error as? TaskSyncError == .savePending, "Failed detail after old receipt stays frozen") }
        expect(coordinator.pendingEditor(recordingID: "rec_synthetic") == frozen, "Old receipt does not discard frozen request")
        expect(store.owner("synthetic-a").resolvedEditorDrafts["rec_synthetic"] == nil, "Stale cached note is not marked resolved")
        await coordinator.setForeground(false)
        let restored = try TaskStore(directory: root)
        expect(restored.owner("synthetic-a").editors["rec_synthetic"] == frozen, "Frozen retry survives relaunch after failed detail")
        let relaunch = TaskCoordinator(store: restored, transport: fake, monitorConnectivity: false)
        relaunch.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await relaunch.refresh()
        fake.failDetail = false
        let reopened = try await relaunch.prepareEditor(recordingID: "rec_synthetic")
        expect(reopened == draft, "Relaunch reopens the same draft")
        let saved = try await relaunch.saveEditor(reopened)
        expect(saved.title == draft.title && saved.summary == draft.summary, "Retry returns current saved prose, never the pre-edit cache")
        expect(saved.todos.count == 2 && fake.editReceipts.count == 1, "Retry creates no duplicate additions")
        expect(fake.edits.count == 3 && fake.edits.allSatisfy { $0 == frozen.request }, "All retries preserve the exact mutation and payload")
        expect(relaunch.pendingEditor(recordingID: "rec_synthetic") == nil, "Only persisted fresh detail settles the frozen editor")
        _ = try await relaunch.saveEditor(draft)
        expect(fake.edits.count == 3, "Confirmed fresh draft recognizes a late Save tap")
        await relaunch.setForeground(false)
    }
    @MainActor static func accountIsolation(_ root: URL) async throws {
        let store = try TaskStore(directory: root)
        let fake = FakeTaskTransport(tasks: [fixtureTask()], note: fixtureNote())
        let coordinator = TaskCoordinator(store: store, transport: fake, now: { fixtureDate() }, monitorConnectivity: false)
        coordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await coordinator.refresh()
        fake.shouldPauseMutation = true
        try coordinator.setCompleted(id: "task-a", completed: true, from: .today)
        for _ in 0..<100 where fake.pauseMutation == nil { await Task.yield() }
        expect(fake.pauseMutation != nil, "Mutation reached controlled suspension")
        coordinator.configure(ownerID: nil, accountGeneration: UUID())
        expect(coordinator.occurrences.isEmpty, "Signed-out state hides owner cache")
        fake.pauseMutation?.resume(); fake.pauseMutation = nil; fake.shouldPauseMutation = false
        for _ in 0..<10 { await Task.yield() }
        expect(store.owner("synthetic-a").commands.count == 1, "Late account response cannot settle old owner's outbox")
        coordinator.configure(ownerID: "synthetic-b", accountGeneration: UUID())
        await coordinator.refresh()
        expect(fake.requests.count == 1, "New account never dispatches prior owner commands")
        try coordinator.accountDeleted(ownerID: "synthetic-b")
        coordinator.configure(ownerID: "synthetic-b", accountGeneration: UUID())
        await coordinator.refresh()
        expect(coordinator.occurrences.isEmpty && store.isDeleted("synthetic-b"), "Deleted owner cannot reload/send")
        await coordinator.setForeground(false)
    }
    @MainActor static func heldOwnerAndRecovery(_ root: URL) async throws {
        let store = try TaskStore(directory: root)
        let fake = FakeTaskTransport(tasks: [fixtureTask()], note: fixtureNote())
        let coordinator = TaskCoordinator(store: store, transport: fake, monitorConnectivity: false)
        coordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await coordinator.refresh()
        fake.requireSignIn = true
        try coordinator.setCompleted(id: "task-a", completed: true, from: .today)
        await coordinator.refresh()
        expect(coordinator.signInRequired && store.owner("synthetic-a").commands.count == 1, "401 retains queued owner mutation")
        let request = fake.requests.last!
        fake.requireSignIn = false
        coordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        await coordinator.refresh()
        expect(!coordinator.signInRequired && store.owner("synthetic-a").commands.isEmpty && fake.requests.last == request, "Same-owner reauth resumes exact queued UUID and body")
        await coordinator.setForeground(false)
        let failing = try TaskStore(directory: root, write: { _, _ in throw TaskSyncError.unavailable })
        let failureCoordinator = TaskCoordinator(store: failing, transport: fake, monitorConnectivity: false)
        await failureCoordinator.setForeground(false)
        failureCoordinator.configure(ownerID: "synthetic-a", accountGeneration: UUID())
        do { try failureCoordinator.recordingDeleted("rec_synthetic"); fatalError("Expected disk write failure") } catch { }
        let hidden = failureCoordinator.snapshot(now: fixtureDate(), timeZone: .current)
        expect(failureCoordinator.occurrences.isEmpty && hidden.today.open.isEmpty && hidden.today.doneToday.isEmpty, "Confirmed remote deletion hides cache despite failed persistence")
        expect(failureCoordinator.decorated(fixtureNote()).todos.isEmpty, "Failed deletion persistence cannot decorate stale tasks")
        do { _ = try await failureCoordinator.openNote(recordingID: "rec_synthetic"); fatalError("Expected deleted source") }
        catch { expect(error as? TaskSyncError == .removed, "Deleted source cannot reopen from cache") }
    }
    @MainActor static func previewEditing(_ root: URL) async throws {
        #if DEBUG
        let store = try TaskStore(directory: root)
        var kept = fixtureTask(); kept.status = "completed"; kept.completedAt = TaskDates.iso(fixtureDate())
        kept.placementOverride = .later; kept.placementAnchorDate = "2026-09-28"
        let fake = FakeTaskTransport(tasks: [], note: fixtureNote())
        let coordinator = TaskCoordinator(store: store, transport: fake, monitorConnectivity: false)
        coordinator.seedPreview(tasks: [kept, fixtureTask("remove", order: 1)], notes: [fixtureNote()], now: fixtureDate())
        var draft = try await coordinator.prepareEditor(recordingID: "rec_synthetic")
        draft.todoRows.removeLast()
        draft.todoRows[0].text = "Synthetic preview rename"
        draft.todoRows.append(TodoEditRow(newText: "Synthetic preview rename"))
        _ = try await coordinator.saveEditor(draft)
        expect(coordinator.occurrences.count == 2 && coordinator.occurrence(id: "remove") == nil, "Preview removes and adds without text merging")
        let edited = coordinator.occurrence(id: kept.id)!
        expect(edited.text == "Synthetic preview rename" && edited.isCompleted && edited.placementOverride == .later, "Preview rename keeps identity/status/move")
        expect(coordinator.occurrences.filter { $0.id != kept.id }.first?.isEarlier == false, "Preview addition is current new occurrence")
        expect(fake.requests.isEmpty && fake.edits.isEmpty && fake.listCalls == 0 && store.document.owners.isEmpty, "Preview never dispatches or writes user task store")
        #endif
    }
    @MainActor static func transportChecks() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [TaskURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let grant = TaskTransport.Authorization(ownerID: "synthetic-a", token: "synthetic-token", generation: UUID())
        var valid = true
        let transport = TaskTransport(session: session, authorize: { _ in grant }, isCurrent: { _ in valid }, reject: { _ in })
        var dispatches = 0
        let command = TaskMutationRequest(mutationID: "synthetic-mutation", expectedVersion: 1, operation: .setCompletion, completed: true)
        TaskURLProtocol.handler = { request in
            expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer synthetic-token", "Session-only bearer")
            let result = TaskMutationResponse(mutationID: "synthetic-mutation", snapshotVersion: 2, task: fixtureTask())
            return (200, try JSONEncoder().encode(result))
        }
        _ = try await transport.mutate(occurrenceID: "task-a", request: command, ownerID: "synthetic-a", beforeDispatch: { dispatches += 1 })
        expect(dispatches == 1, "Before-dispatch durable hook")
        valid = false
        do { _ = try await transport.mutate(occurrenceID: "task-a", request: command, ownerID: "synthetic-a", beforeDispatch: { dispatches += 1 }); fatalError("Expected invalid session") } catch { }
        expect(dispatches == 1, "Stale authorization rejected before dispatch")
        valid = true
        let lateTransport = TaskTransport(session: session, authorize: { _ in grant }, isCurrent: { _ in valid }, reject: { _ in })
        do {
            _ = try await lateTransport.mutate(occurrenceID: "task-a", request: command, ownerID: "synthetic-a", beforeDispatch: { valid = false })
            fatalError("Expected late authorization rejection")
        } catch { expect(error is CancellationError, "Response cannot cross auth generation") }
        valid = true
        var page = 0
        TaskURLProtocol.handler = { request in
            page += 1
            let result = TaskListResponse(contractVersion: 1, cutoverAt: "2026-09-30T00:00:00Z", snapshotVersion: 5,
                tasks: [fixtureTask(page == 1 ? "task-a" : "task-b")], nextCursor: page == 1 ? "synthetic-next" : nil)
            if page == 2 { expect(request.url!.absoluteString.contains("cursor=synthetic-next"), "Opaque cursor preserved") }
            return (200, try JSONEncoder().encode(result))
        }
        let pages = try await transport.list(ownerID: "synthetic-a")
        expect(pages.tasks.count == 2 && pages.nextCursor == nil, "Only complete snapshot is exposed")
        page = 0
        var restarts = 0
        TaskURLProtocol.handler = { request in
            if !request.url!.absoluteString.contains("cursor=") { restarts += 1; page = 0 }
            page += 1
            return (200, try JSONEncoder().encode(TaskListResponse(contractVersion: 1, cutoverAt: "2026-09-30T00:00:00Z", snapshotVersion: Int64(restarts * 2 + page),
                tasks: [fixtureTask(page == 1 ? "task-a" : "task-b")], nextCursor: page == 1 ? "next" : nil)))
        }
        do { _ = try await transport.list(ownerID: "synthetic-a"); fatalError("Expected inconsistent pages rejection") }
        catch { expect(error as? TaskSyncError == .invalidResponse, "Changing snapshot pages never mix") }
        expect(restarts == 3, "Changing snapshot restarts are bounded")
        valid = true
        TaskURLProtocol.handler = { _ in (409, Data("{\"error_code\":\"version_conflict\",\"error\":\"safe synthetic\"}".utf8)) }
        do { _ = try await transport.mutate(occurrenceID: "task-a", request: command, ownerID: "synthetic-a", beforeDispatch: {}); fatalError("Expected conflict") }
        catch { expect(error as? TaskSyncError == .conflict, "Typed bounded server error") }
    }
}
final class TaskURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status, data) = try Self.handler!(request)
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}
