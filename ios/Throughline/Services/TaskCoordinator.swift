import Foundation
import Combine
import Network
#if canImport(UIKit)
import UIKit
#endif

@MainActor final class TaskCoordinator: ObservableObject {
    @Published private(set) var occurrences: [TaskOccurrence] = []
    @Published private(set) var hasLoadedSnapshot = false
    @Published private(set) var isRefreshing = false
    @Published private(set) var isOffline = false
    @Published private(set) var signInRequired = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var revision: UInt64 = 0
    var onNote: ((ThroughlineNote) -> Void)?

    private let store: TaskStore?
    private let transport: any TaskTransporting
    private let clock: () -> Date
    private(set) var ownerID: String?
    private var generation = UUID()
    private var foreground = true
    private var deletionPending = false
    private var blockedRecordingIDs: Set<String> = []
    private var work: Task<Void, Never>?
    private var workID: UUID?
    private var midnight: Task<Void, Never>?
    private var wantsRefresh = false
    private var locked = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var monitor: NWPathMonitor?
    private var observers: [NSObjectProtocol] = []
    private var preview = false
    private var previewTasks: [TaskOccurrence] = []
    private var previewNotes: [ThroughlineNote] = []
    private var previewNow: Date?

    init(store: TaskStore? = nil, transport: (any TaskTransporting)? = nil,
         now: @escaping () -> Date = { Date() }, monitorConnectivity: Bool = true) {
        self.store = store ?? (try? TaskStore())
        self.transport = transport ?? TaskTransport()
        clock = now
        #if DEBUG
        preview = ProcessInfo.processInfo.arguments.contains { $0.hasPrefix("--throughline-preview-") }
        #endif
        if self.store == nil { errorMessage = TaskSyncError.unavailable.localizedDescription }
        if monitorConnectivity && !preview {
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { [weak self] path in
                Task { @MainActor in
                    guard let self, !self.preview else { return }
                    let wasOffline = self.isOffline
                    self.isOffline = path.status != .satisfied
                    if wasOffline && !self.isOffline { self.schedule() }
                }
            }
            monitor.start(queue: DispatchQueue(label: "app.throughline.task-connectivity"))
            self.monitor = monitor
        }
        for name in [Notification.Name.NSSystemTimeZoneDidChange, .NSCalendarDayChanged] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.clockChanged() }
            })
        }
        #if canImport(UIKit)
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.significantTimeChangeNotification,
            object: nil, queue: .main) { [weak self] _ in Task { @MainActor in self?.clockChanged() } })
        #endif
    }
    private var now: Date { previewNow ?? clock() }
    private var state: TaskStore.OwnerState {
        guard let ownerID else { return TaskStore.OwnerState() }
        return store?.owner(ownerID) ?? TaskStore.OwnerState()
    }
    func configure(ownerID: String?, accountGeneration: UUID) {
        invalidate()
        if self.ownerID != ownerID { blockedRecordingIDs.removeAll() }
        self.ownerID = ownerID
        generation = accountGeneration
        deletionPending = ownerID.map { store?.isDeleted($0) == true } ?? false
        signInRequired = false
        errorMessage = store == nil ? TaskSyncError.unavailable.localizedDescription : nil
        publish()
        wantsRefresh = ownerID != nil
        scheduleMidnight()
        schedule()
    }
    func setAccountDeletionPending(_ pending: Bool) {
        if deletionPending == pending { return }
        deletionPending = pending
        if pending { invalidate() } else { schedule() }
        publish()
    }
    func accountDeleted(ownerID: String) throws {
        invalidate()
        if self.ownerID == ownerID { self.ownerID = nil; deletionPending = true; publish() }
        guard let store else { throw TaskSyncError.unavailable }
        try store.deleteOwner(ownerID)
    }
    func recordingDeleted(_ recordingID: String) throws {
        guard let ownerID, let store else { throw TaskSyncError.signedOut }
        blockedRecordingIDs.insert(recordingID)
        defer { publish() }
        try store.transaction(ownerID: ownerID) { state in
            state.deletedRecordingIDs.insert(recordingID)
            state.tasks.removeAll { $0.recordingID == recordingID }
            state.commands.removeAll { $0.recordingID == recordingID }
            state.editors.removeValue(forKey: recordingID)
            state.resolvedEditorDrafts.removeValue(forKey: recordingID)
            state.notes.removeValue(forKey: recordingID)
            state.needsRefresh = true
        }
        publish()
        wantsRefresh = true
        schedule()
    }
    func snapshot(now: Date, timeZone: TimeZone) -> RunningListSnapshot {
        guard !deletionPending, preview || ownerID != nil else { return RunningListSnapshot() }
        if preview { return RunningListProjection.project(occurrences: previewTasks, now: now, timeZone: timeZone) }
        return RunningListProjection.project(occurrences: state.tasks.filter { !blockedRecordingIDs.contains($0.recordingID) },
            commands: state.commands, now: now, timeZone: timeZone)
    }
    var allOccurrenceIDs: Set<String> { Set(occurrences.map(\.id)) }
    func occurrence(id: String) -> TaskOccurrence? { occurrences.first { $0.id == id } }
    func clearError() { errorMessage = nil }
    func setCompleted(id: String, completed: Bool, from placement: TaskPresentationPlacement) throws {
        guard let item = occurrence(id: id) else { throw TaskSyncError.removed }
        let request = TaskMutationRequest(mutationID: UUID().uuidString.lowercased(), expectedVersion: item.version,
            operation: .setCompletion, completed: completed, occurredAt: TaskDates.iso(now),
            completionPlacement: completed ? placement.tab : nil)
        try enqueue(item: item, request: request)
    }
    func move(id: String, to tab: RunningListTab, now: Date, timeZone: TimeZone) throws {
        guard let item = occurrence(id: id) else { throw TaskSyncError.removed }
        let request = TaskMutationRequest(mutationID: UUID().uuidString.lowercased(), expectedVersion: item.version,
            operation: .setPlacement, placement: tab, anchorDate: TaskDates.civil(now, zone: timeZone))
        try enqueue(item: item, request: request)
    }
    private func enqueue(item: TaskOccurrence, request: TaskMutationRequest) throws {
        guard !deletionPending else { throw TaskSyncError.deletionPending }
        let command = TaskPendingCommand(id: request.mutationID, recordingID: item.recordingID, occurrenceID: item.id, request: request)
        if preview {
            previewTasks = RunningListProjection.overlay(previewTasks, commands: [command])
            publish(); return
        }
        guard let ownerID, !deletionPending else { throw TaskSyncError.signedOut }
        guard let store else { throw TaskSyncError.unavailable }
        try store.transaction(ownerID: ownerID) { state in
            guard state.editors[item.recordingID] == nil else { throw TaskSyncError.pendingChanges }
            guard state.tasks.contains(where: { $0.id == item.id && $0.recordingID == item.recordingID }),
                  !state.deletedRecordingIDs.contains(item.recordingID) else { throw TaskSyncError.removed }
            state.commands.append(command)
        }
        errorMessage = nil
        publish()
        schedule()
    }
    func pendingEditor(recordingID: String) -> PendingEditorState? {
        guard !deletionPending, ownerID != nil, !blockedRecordingIDs.contains(recordingID) else { return nil }
        return state.editors[recordingID]
    }
    func decorated(_ original: ThroughlineNote) -> ThroughlineNote {
        guard !deletionPending, preview || ownerID != nil, !blockedRecordingIDs.contains(original.id) else {
            var hidden = original
            hidden.todos = []; hidden.actionItems = []; hidden.taskContractVersion = nil; hidden.taskRevision = nil
            return hidden
        }
        let source = preview ? previewTasks : occurrences
        let tasks = source.filter { $0.recordingID == original.id }.sorted { $0.sourceOrder < $1.sourceOrder }
        guard preview || state.knownRecordingIDs.contains(original.id) || !tasks.isEmpty else {
            var unknown = original
            unknown.taskContractVersion = nil
            unknown.taskRevision = nil
            return unknown
        }
        var note = original
        note.taskContractVersion = 1
        note.taskRevision = preview ? (previewNotes.first { $0.id == note.id }?.taskRevision ?? 1) : state.notes[note.id]?.taskRevision
        note.todos = tasks.map { task in
            let previous = original.todos.first { $0.id == task.id }
            return Todo(id: task.id, text: task.text, status: task.status, priority: previous?.priority,
                due: task.due, forDate: task.forDate, context: previous?.context, completedAt: task.completedAt)
        }
        return note
    }
    func openNote(recordingID: String) async throws -> ThroughlineNote {
        guard !deletionPending else { throw TaskSyncError.deletionPending }
        guard !blockedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
        if preview {
            guard let note = previewNotes.first(where: { $0.id == recordingID }) else { throw TaskSyncError.removed }
            return decorated(note)
        }
        let context = try context()
        await acquire()
        defer { release() }
        try check(context)
        if !state.hasSnapshot { try await fetchSnapshot(context) }
        let envelope = try await transport.detail(recordingID: recordingID, ownerID: context.owner)
        try check(context)
        guard let store else { throw TaskSyncError.unavailable }
        var applied = false
        try store.transaction(ownerID: context.owner) { applied = try TaskStore.apply(envelope, to: &$0) }
        guard applied else { throw TaskSyncError.invalidResponse }
        publish()
        let note = decorated(envelope.note)
        onNote?(note)
        return note
    }
    func prepareEditor(recordingID: String) async throws -> NoteEditDraft {
        guard !deletionPending else { throw TaskSyncError.deletionPending }
        guard !blockedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
        if preview {
            guard let note = previewNotes.first(where: { $0.id == recordingID }) else { throw TaskSyncError.removed }
            return NoteEditDraft(note: decorated(note))
        }
        let context = try context()
        if let pending = pendingEditor(recordingID: recordingID), pending.isFrozen { return pending.draft }
        await acquire()
        defer { release() }
        try check(context)
        try await drainCommands(context, onlyRecordingID: recordingID)
        if !state.hasSnapshot { try await fetchSnapshot(context) }
        guard !state.commands.contains(where: { $0.recordingID == recordingID }) else { throw TaskSyncError.pendingChanges }
        if let pending = pendingEditor(recordingID: recordingID) { return pending.draft }
        let envelope = try await transport.detail(recordingID: recordingID, ownerID: context.owner)
        try check(context)
        guard !state.deletedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
        guard let store else { throw TaskSyncError.unavailable }
        var applied = false
        try store.transaction(ownerID: context.owner) { applied = try TaskStore.apply(envelope, to: &$0) }
        guard applied else { throw TaskSyncError.invalidResponse }
        publish()
        let note = decorated(envelope.note)
        onNote?(note)
        return NoteEditDraft(note: note)
    }
    func saveEditor(_ draft: NoteEditDraft) async throws -> ThroughlineNote {
        guard !deletionPending else { throw TaskSyncError.deletionPending }
        guard let recordingID = draft.recordingID, let expected = draft.expectedTaskRevision, draft.canSave else { throw TaskSyncError.conflict }
        guard !blockedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
        if preview {
            guard var note = previewNotes.first(where: { $0.id == recordingID }) else { throw TaskSyncError.removed }
            note.title = draft.trimmedTitle; note.summary = draft.trimmedSummary; note.transcript = draft.trimmedTranscript
            note.mostImportant = draft.mostImportant
            note.taskRevision = (note.taskRevision ?? 1) + 1
            let oldTasks = previewTasks.filter { $0.recordingID == recordingID }
            var edited: [TaskOccurrence] = []
            for row in draft.todoRows {
                let text = row.text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { continue }
                var task: TaskOccurrence
                if let id = row.occurrenceID, let existing = oldTasks.first(where: { $0.id == id }) {
                    task = existing; task.version += 1
                } else if row.clientItemID != nil {
                    task = TaskOccurrence(id: UUID().uuidString.lowercased(), recordingID: recordingID, version: 1,
                        sourceOrder: edited.count, text: text, status: "open", createdAt: TaskDates.iso(now),
                        originLocalDate: TaskDates.civil(now, zone: .current), sourceCreatedAt: TaskDates.iso(note.createdAt),
                        sourceLocalDate: TaskDates.civil(note.createdAt, zone: .current), sourceTimezone: TimeZone.current.identifier,
                        sourceTitle: note.title, isEarlier: false)
                } else { throw TaskSyncError.conflict }
                task.text = text; task.sourceTitle = note.title; task.sourceOrder = edited.count
                edited.append(task)
            }
            previewTasks.removeAll { $0.recordingID == recordingID }; previewTasks.append(contentsOf: edited)
            previewNotes.removeAll { $0.id == recordingID }; previewNotes.append(note)
            publish()
            let result = decorated(note)
            onNote?(result)
            return result
        }
        let context = try context()
        await acquire()
        defer { release() }
        try check(context)
        guard let store else { throw TaskSyncError.unavailable }
        if state.editors[recordingID] == nil {
            if state.resolvedEditorDrafts[recordingID] == draft, let note = state.notes[recordingID]?.note {
                return decorated(note)
            }
            guard !state.commands.contains(where: { $0.recordingID == recordingID }) else { throw TaskSyncError.pendingChanges }
            let rows = try draft.todoRows.compactMap { row -> TaskEditRequest.Item? in
                let text = row.text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { return nil }
                guard (row.occurrenceID != nil) != (row.clientItemID != nil) else { throw TaskSyncError.conflict }
                return TaskEditRequest.Item(id: row.occurrenceID, clientItemID: row.clientItemID, text: text)
            }
            let request = TaskEditRequest(mutationID: UUID().uuidString.lowercased(), expectedTaskRevision: expected,
                title: draft.trimmedTitle, summary: draft.trimmedSummary, transcript: draft.trimmedTranscript,
                mostImportant: draft.mostImportant, todos: rows, editedLocalDate: TaskDates.civil(now, zone: .current), editedTimezone: TimeZone.current.identifier)
            try store.transaction(ownerID: context.owner) { state in
                guard !state.deletedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
                state.editors[recordingID] = PendingEditorState(draft: draft, request: request, dispatched: false)
            }
        }
        publish()
        return try await sendEditor(recordingID, context: context)
    }
    func refresh() async {
        guard !preview else { publish(); return }
        wantsRefresh = true
        isOffline = false // A deliberate retry can recover even when reachability has not emitted a new path.
        schedule()
        let pending = work
        await pending?.value
    }
    func requestRefresh() { wantsRefresh = true; schedule() }
    func setForeground(_ active: Bool) async {
        foreground = active
        if !active { invalidate(); midnight?.cancel() }
        else { clockChanged(); await refresh() }
    }
    private struct Context { var owner: String; var generation: UUID }
    private func context() throws -> Context {
        guard let ownerID else { throw TaskSyncError.signedOut }
        guard !deletionPending else { throw TaskSyncError.deletionPending }
        guard !preview, store != nil else { throw TaskSyncError.unavailable }
        return Context(owner: ownerID, generation: generation)
    }
    private func check(_ context: Context) throws {
        try Task.checkCancellation()
        guard ownerID == context.owner, generation == context.generation, foreground, !preview else { throw CancellationError() }
        guard !deletionPending else { throw TaskSyncError.deletionPending }
    }
    private func acquire() async {
        if !locked { locked = true; return }
        await withCheckedContinuation { waiters.append($0) }
    }
    private func release() {
        if waiters.isEmpty { locked = false } else { waiters.removeFirst().resume() }
    }
    private func invalidate() {
        generation = UUID()
        isRefreshing = false
        work?.cancel(); work = nil; workID = nil
    }
    private func schedule() {
        guard !preview, foreground, ownerID != nil, !deletionPending, !isOffline, !signInRequired, store != nil, work == nil else { return }
        let id = UUID()
        workID = id
        work = Task { [weak self] in
            guard let self else { return }
            let completed = await self.synchronize()
            if self.workID == id {
                self.work = nil; self.workID = nil
                if completed && self.wantsRefresh { self.schedule() }
            }
        }
    }
    private func synchronize() async -> Bool {
        guard let context = try? context() else { return false }
        await acquire()
        defer { release() }
        do {
            try check(context)
            isRefreshing = true
            defer { if ownerID == context.owner && generation == context.generation { isRefreshing = false } }
            // Resolve dispatched writes before a full snapshot can erase their optimistic overlay.
            try await drainCommands(context)
            // Note edits retry only when Save is tapped. Unknown edits stay frozen across relaunch.
            if wantsRefresh || state.needsRefresh || !state.hasSnapshot {
                wantsRefresh = false
                try await fetchSnapshot(context)
            }
            // Commands enqueued while fetching also receive their turn without another user gesture.
            try await drainCommands(context)
            return true
        } catch {
            guard ownerID == context.owner && generation == context.generation else { return false }
            handle(error)
            return false
        }
    }
    private func fetchSnapshot(_ context: Context) async throws {
        let response = try await transport.list(ownerID: context.owner)
        try check(context)
        guard let store else { throw TaskSyncError.unavailable }
        try store.transaction(ownerID: context.owner) { try TaskStore.apply(response, to: &$0) }
        publish()
    }
    private func drainCommands(_ context: Context, onlyRecordingID: String? = nil) async throws {
        guard let store else { throw TaskSyncError.unavailable }
        while let first = store.owner(context.owner).commands.first(where: { onlyRecordingID == nil || $0.recordingID == onlyRecordingID }) {
            try check(context)
            if state.needsRefresh && !first.dispatched { try await fetchSnapshot(context) }
            guard state.tasks.contains(where: { $0.id == first.occurrenceID }) || first.dispatched else {
                try store.transaction(ownerID: context.owner) { $0.commands.removeAll { $0.id == first.id } }
                publish(); continue
            }
            guard let command = state.commands.first(where: { $0.id == first.id }) else { continue }
            do {
                let result = try await transport.mutate(occurrenceID: command.occurrenceID, request: command.request,
                    ownerID: context.owner, beforeDispatch: {
                        try self.check(context)
                        try store.transaction(ownerID: context.owner) { state in
                            guard let index = state.commands.firstIndex(where: { $0.id == command.id }),
                                  !state.deletedRecordingIDs.contains(command.recordingID) else { throw TaskSyncError.removed }
                            state.commands[index].dispatched = true
                        }
                    })
                try check(context)
                guard !blockedRecordingIDs.contains(command.recordingID) else { throw TaskSyncError.removed }
                guard result.mutationID == command.id, result.task.id == command.occurrenceID,
                      result.task.recordingID == command.recordingID else { throw TaskSyncError.invalidResponse }
                try store.transaction(ownerID: context.owner) { state in
                    guard state.commands.contains(where: { $0.id == command.id }) else { return }
                    _ = try TaskStore.apply(result, to: &state)
                    state.commands.removeAll { $0.id == command.id }
                    if let next = state.commands.firstIndex(where: { $0.occurrenceID == command.occurrenceID && !$0.dispatched }) {
                        // Only our immediately preceding success can advance a never-dispatched dependency.
                        state.commands[next].request.expectedVersion = result.task.version
                    }
                }
                publish()
            } catch {
                try check(context)
                if let error = error as? TaskSyncError, error.isPermanent {
                    try store.transaction(ownerID: context.owner) { state in
                        state.commands.removeAll { $0.id == command.id }
                        state.needsRefresh = true
                    }
                    errorMessage = error == .conflict ? "This task changed. Your change wasn't saved." : error.localizedDescription
                    publish()
                    try await fetchSnapshot(context)
                    continue
                }
                throw error
            }
        }
    }
    private func sendEditor(_ recordingID: String, context: Context) async throws -> ThroughlineNote {
        guard let store, let pending = state.editors[recordingID] else { throw TaskSyncError.conflict }
        do {
            let response = try await transport.edit(recordingID: recordingID, request: pending.request,
                ownerID: context.owner, beforeDispatch: {
                    try self.check(context)
                    try store.transaction(ownerID: context.owner) { state in
                        guard var editor = state.editors[recordingID], editor.request.mutationID == pending.request.mutationID,
                              !state.deletedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
                        editor.dispatched = true
                        state.editors[recordingID] = editor
                    }
                    self.publish()
                })
            try check(context)
            guard !blockedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
            guard response.mutationID == pending.request.mutationID, response.note.id == recordingID else { throw TaskSyncError.invalidResponse }
            var applied = false
            try store.transaction(ownerID: context.owner) { state in
                guard state.editors[recordingID]?.request.mutationID == pending.request.mutationID,
                      !state.deletedRecordingIDs.contains(recordingID) else { throw TaskSyncError.removed }
                applied = try TaskStore.apply(response, to: &state)
                state.editors.removeValue(forKey: recordingID)
                state.resolvedEditorDrafts[recordingID] = pending.draft
            }
            if !applied {
                // The replay proves this edit, but its old note is not the current note.
                let current = try await transport.detail(recordingID: recordingID, ownerID: context.owner)
                try check(context)
                try store.transaction(ownerID: context.owner) { _ = try TaskStore.apply(current, to: &$0) }
            }
            publish()
            guard let note = state.notes[recordingID]?.note else { throw TaskSyncError.invalidResponse }
            let decorated = decorated(note)
            onNote?(decorated)
            errorMessage = nil
            return decorated
        } catch {
            try check(context)
            if let error = error as? TaskSyncError, error.isPermanent {
                try store.transaction(ownerID: context.owner) { state in
                    state.editors.removeValue(forKey: recordingID)
                    state.needsRefresh = true
                }
                publish()
                errorMessage = error.localizedDescription
                throw error
            }
            if state.editors[recordingID]?.dispatched == true {
                publish()
                handle(error)
                throw TaskSyncError.savePending
            }
            try store.transaction(ownerID: context.owner) { $0.editors.removeValue(forKey: recordingID) }
            publish()
            handle(error)
            throw error
        }
    }
    private func handle(_ error: Error) {
        if error is CancellationError { return }
        if (error as? TaskSyncError) == .signedOut { signInRequired = true }
        if (error as? TaskSyncError) == .deletionPending { setAccountDeletionPending(true) }
        if let error = error as? URLError, [.notConnectedToInternet, .networkConnectionLost].contains(error.code) { isOffline = true }
        errorMessage = (error as? TaskSyncError)?.localizedDescription ?? "Couldn't refresh your notes. Pull down to try again."
    }
    private func publish() {
        if deletionPending {
            occurrences = []; hasLoadedSnapshot = false
        } else if preview {
            occurrences = previewTasks; hasLoadedSnapshot = true
        } else if ownerID == nil {
            occurrences = []; hasLoadedSnapshot = false
        } else {
            occurrences = RunningListProjection.overlay(state.tasks, commands: state.commands).filter { !blockedRecordingIDs.contains($0.recordingID) }
            hasLoadedSnapshot = state.hasSnapshot
        }
        revision &+= 1
    }
    private func clockChanged() { publish(); scheduleMidnight() }
    private func scheduleMidnight() {
        midnight?.cancel()
        guard foreground, !preview else { return }
        let interval = max(1, TaskDates.nextMidnight(after: now, zone: .current).timeIntervalSince(now))
        midnight = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000)) } catch { return }
            self?.clockChanged()
        }
    }
    #if DEBUG
    func seedPreview(tasks: [TaskOccurrence], notes: [ThroughlineNote], offline: Bool = false, now: Date? = nil) {
        invalidate(); midnight?.cancel(); monitor?.cancel()
        preview = true; previewTasks = tasks; previewNotes = notes; previewNow = now
        isOffline = offline; isRefreshing = false; errorMessage = nil
        publish()
    }
    #endif
}
