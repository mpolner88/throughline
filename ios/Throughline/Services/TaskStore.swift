import Foundation
import Darwin

/// Account-private task cache and outbox. Never used as an analytics/report store.
@MainActor final class TaskStore {
    struct OwnerState: Codable, Equatable {
        var tasks: [TaskOccurrence] = []
        var notes: [String: TaskNoteEnvelope] = [:]
        var commands: [TaskPendingCommand] = []
        var editors: [String: PendingEditorState] = [:]
        var resolvedEditorDrafts: [String: NoteEditDraft] = [:]
        var deletedRecordingIDs: Set<String> = []
        var knownRecordingIDs: Set<String> = []
        var cutoverAt: String?
        var lastFullSnapshotVersion: Int64 = -1
        var minimumSnapshotVersion: Int64 = -1
        var needsRefresh = false
        var hasSnapshot: Bool { cutoverAt != nil && lastFullSnapshotVersion >= 0 }
    }
    struct Document: Codable {
        var version = 1
        var owners: [String: OwnerState] = [:]
        // Keep deletion intent durable even if removing the remaining cache fails.
        var deletedOwners: Set<String> = []
    }
    private(set) var document: Document
    private let file: URL
    private let writer: (Data, URL) throws -> Void
    init(directory: URL? = nil, write: @escaping (Data, URL) throws -> Void = TaskStore.atomicWrite) throws {
        let directory = try directory ?? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: true).appendingPathComponent("RunningListStore", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Self.protect(directory)
        file = directory.appendingPathComponent("tasks.json")
        writer = write
        if FileManager.default.fileExists(atPath: file.path) {
            document = try JSONDecoder().decode(Document.self, from: Data(contentsOf: file))
            guard document.version == 1 else { throw TaskSyncError.unavailable }
        } else { document = Document() }
    }
    func owner(_ id: String) -> OwnerState { document.owners[id] ?? OwnerState() }
    func isDeleted(_ ownerID: String) -> Bool { document.deletedOwners.contains(ownerID) }
    func transaction(ownerID: String, _ change: (inout OwnerState) throws -> Void) throws {
        guard !isDeleted(ownerID) else { throw TaskSyncError.deletionPending }
        var candidate = document
        var state = candidate.owners[ownerID] ?? OwnerState()
        try change(&state)
        candidate.owners[ownerID] = state
        try commit(candidate)
    }
    func deleteOwner(_ ownerID: String) throws {
        var candidate = document
        candidate.deletedOwners.insert(ownerID)
        candidate.owners.removeValue(forKey: ownerID)
        try commit(candidate)
    }
    private func commit(_ candidate: Document) throws {
        do { try writer(JSONEncoder().encode(candidate), file) }
        catch { throw TaskSyncError.unavailable }
        document = candidate
    }
    static func validate(_ tasks: [TaskOccurrence]) throws {
        guard Set(tasks.map(\.id)).count == tasks.count,
              tasks.allSatisfy({ !$0.id.isEmpty && !$0.recordingID.isEmpty && $0.version > 0 && $0.sourceOrder >= 0 })
        else { throw TaskSyncError.invalidResponse }
    }
    static func apply(_ response: TaskListResponse, to state: inout OwnerState) throws {
        guard response.contractVersion == 1, response.nextCursor == nil,
              TaskDates.instant(response.cutoverAt) != nil else { throw TaskSyncError.invalidResponse }
        try validate(response.tasks)
        guard response.snapshotVersion >= state.minimumSnapshotVersion,
              response.snapshotVersion >= state.lastFullSnapshotVersion else { throw TaskSyncError.invalidResponse }
        state.tasks = response.tasks.filter { !state.deletedRecordingIDs.contains($0.recordingID) }
        state.knownRecordingIDs.formUnion(response.tasks.map(\.recordingID))
        state.cutoverAt = response.cutoverAt
        state.lastFullSnapshotVersion = response.snapshotVersion
        state.minimumSnapshotVersion = response.snapshotVersion
        state.needsRefresh = false
        // A full list does not carry note-edit versions; any cached edit base must be fetched again.
        state.notes = state.notes.filter { !state.deletedRecordingIDs.contains($0.key) }
    }
    @discardableResult static func apply(_ response: TaskMutationResponse, to state: inout OwnerState) throws -> Bool {
        try validate([response.task])
        let index = state.tasks.firstIndex { $0.id == response.task.id }
        guard !state.deletedRecordingIDs.contains(response.task.recordingID),
              response.snapshotVersion >= state.minimumSnapshotVersion,
              index != nil || response.snapshotVersion > state.lastFullSnapshotVersion,
              index.map({ state.tasks[$0].version <= response.task.version }) ?? true else { return false }
        if let index { state.tasks[index] = response.task } else { state.tasks.append(response.task) }
        state.knownRecordingIDs.insert(response.task.recordingID)
        state.notes.removeValue(forKey: response.task.recordingID)
        state.minimumSnapshotVersion = max(state.minimumSnapshotVersion, response.snapshotVersion)
        return true
    }
    @discardableResult static func apply(_ response: TaskNoteEnvelope, to state: inout OwnerState) throws -> Bool {
        try validate(response.tasks)
        guard response.tasks.allSatisfy({ $0.recordingID == response.note.id }), response.taskRevision > 0 else { throw TaskSyncError.invalidResponse }
        guard !state.deletedRecordingIDs.contains(response.note.id),
              response.snapshotVersion >= state.minimumSnapshotVersion,
              response.taskRevision >= (state.notes[response.note.id]?.taskRevision ?? 0) else { return false }
        state.tasks.removeAll { $0.recordingID == response.note.id }
        state.tasks.append(contentsOf: response.tasks)
        state.knownRecordingIDs.insert(response.note.id)
        state.notes[response.note.id] = response
        state.minimumSnapshotVersion = max(state.minimumSnapshotVersion, response.snapshotVersion)
        return true
    }
    nonisolated static func atomicWrite(_ data: Data, _ file: URL) throws {
        let staging = file.deletingLastPathComponent().appendingPathComponent(".tasks-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: staging) }
        #if os(iOS)
        try data.write(to: staging, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: staging, options: .atomic)
        #endif
        try protect(staging)
        let handle = try FileHandle(forWritingTo: staging)
        do { try handle.synchronize(); try handle.close() }
        catch { try? handle.close(); throw error }
        // Every fallible preparation occurs before commit. No error can report failure after rename.
        guard Darwin.rename(staging.path, file.path) == 0 else {
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
    }
    nonisolated private static func protect(_ file: URL) throws {
        var file = file
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try file.setResourceValues(values)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: file.path)
        #endif
    }
}
