import Foundation

enum RunningListTab: String, Codable, CaseIterable, Identifiable {
    case today, thisWeek = "this_week", later
    var id: String { rawValue }
}
enum TaskPresentationPlacement: String, Codable {
    case today, thisWeek = "this_week", later, earlier
    var tab: RunningListTab {
        switch self { case .today: .today; case .thisWeek: .thisWeek; case .later, .earlier: .later }
    }
}
struct TaskOccurrence: Codable, Equatable, Identifiable {
    var id: String
    var recordingID: String
    var version: Int64
    var sourceOrder: Int
    var text: String
    var status: String
    var completedAt: String?
    var due: String?
    var forDate: String?
    var createdAt: String
    var originLocalDate: String?
    var sourceCreatedAt: String
    var sourceLocalDate: String?
    var sourceTimezone: String?
    var sourceTitle: String
    var isEarlier: Bool
    var placementOverride: RunningListTab?
    var placementAnchorDate: String?
    var completedPlacement: RunningListTab?
    var isCompleted: Bool { status == "completed" || status == "done" }
    var sourceDate: Date { TaskDates.instant(sourceCreatedAt) ?? .distantPast }
    enum CodingKeys: String, CodingKey {
        case id, version, text, status, due
        case recordingID = "recording_id", sourceOrder = "source_order", completedAt = "completed_at"
        case forDate = "for_date", createdAt = "created_at", originLocalDate = "origin_local_date"
        case sourceCreatedAt = "source_created_at", sourceLocalDate = "source_local_date"
        case sourceTimezone = "source_timezone", sourceTitle = "source_title", isEarlier = "is_earlier"
        case placementOverride = "placement_override", placementAnchorDate = "placement_anchor_date"
        case completedPlacement = "completed_placement"
    }
}
struct TaskListResponse: Codable, Equatable {
    var contractVersion: Int
    var cutoverAt: String
    var snapshotVersion: Int64
    var tasks: [TaskOccurrence]
    var nextCursor: String?
    enum CodingKeys: String, CodingKey {
        case tasks
        case contractVersion = "contract_version", cutoverAt = "cutover_at"
        case snapshotVersion = "snapshot_version", nextCursor = "next_cursor"
    }
}
struct TaskMutationRequest: Codable, Equatable {
    enum Operation: String, Codable { case setCompletion = "set_completion", setPlacement = "set_placement" }
    var mutationID: String
    var expectedVersion: Int64
    var operation: Operation
    var completed: Bool?
    var occurredAt: String?
    var completionPlacement: RunningListTab?
    var placement: RunningListTab?
    var anchorDate: String?
    enum CodingKeys: String, CodingKey {
        case operation, completed, placement
        case mutationID = "mutation_id", expectedVersion = "expected_version", occurredAt = "occurred_at"
        case completionPlacement = "completion_placement", anchorDate = "anchor_date"
    }
}
struct TaskMutationResponse: Codable, Equatable {
    var mutationID: String
    var snapshotVersion: Int64
    var task: TaskOccurrence
    enum CodingKeys: String, CodingKey {
        case task
        case mutationID = "mutation_id", snapshotVersion = "snapshot_version"
    }
}
struct TaskEditRequest: Codable, Equatable {
    struct Item: Codable, Equatable {
        var id: String?
        var clientItemID: String?
        var text: String
        enum CodingKeys: String, CodingKey { case id, text; case clientItemID = "client_item_id" }
    }
    var taskContractVersion = 1
    var mutationID: String
    var expectedTaskRevision: Int64
    var title: String
    var summary: String
    var transcript: String
    var mostImportant: [String]
    var todos: [Item]
    var editedLocalDate: String
    var editedTimezone: String
    enum CodingKeys: String, CodingKey {
        case title, summary, transcript, todos
        case taskContractVersion = "task_contract_version", mutationID = "mutation_id"
        case expectedTaskRevision = "expected_task_revision", mostImportant = "most_important"
        case editedLocalDate = "edited_local_date", editedTimezone = "edited_timezone"
    }
}
/// Ordinary note state; evaluation revisions and capture receipts are not task versions.
struct TaskNoteEnvelope: Codable, Equatable {
    var note: ThroughlineNote
    var taskRevision: Int64
    var snapshotVersion: Int64
    var tasks: [TaskOccurrence]
    var mutationID: String?
}
struct TaskPendingCommand: Codable, Equatable, Identifiable {
    var id: String
    var recordingID: String
    var occurrenceID: String
    var request: TaskMutationRequest
    var dispatched = false
}
struct PendingEditorState: Codable, Equatable {
    var draft: NoteEditDraft
    var request: TaskEditRequest
    var dispatched: Bool
    var isFrozen: Bool { dispatched }
}
enum TaskSyncError: LocalizedError, Equatable {
    case unavailable, invalidResponse, snapshotChanged, signedOut, conflict, removed, deletionPending, savePending, pendingChanges
    case server(Int, String)
    var errorDescription: String? {
        switch self {
        case .unavailable: "Couldn't save the change on this phone. Try again."
        case .invalidResponse, .snapshotChanged: "Couldn't refresh your tasks. Pull down to try again."
        case .signedOut: "Sign in again to save your changes."
        case .conflict: "This note changed since you started editing. Nothing was saved. Close it and edit again."
        case .removed: "This task is no longer in the note."
        case .deletionPending: "Your account is being deleted."
        case .savePending: "Couldn't confirm the save. Tap Save to try again."
        case .pendingChanges: "Your earlier changes are still saving. Try again when you're connected."
        case .server: "Couldn't save your change. Try again."
        }
    }
    var isPermanent: Bool {
        switch self {
        case .conflict, .removed: true
        case .server(let status, _): (400..<500).contains(status) && ![401,408,423,429].contains(status)
        default: false
        }
    }
}
@MainActor protocol TaskTransporting {
    func list(ownerID: String) async throws -> TaskListResponse
    func detail(recordingID: String, ownerID: String) async throws -> TaskNoteEnvelope
    func mutate(occurrenceID: String, request: TaskMutationRequest, ownerID: String,
                beforeDispatch: () throws -> Void) async throws -> TaskMutationResponse
    func edit(recordingID: String, request: TaskEditRequest, ownerID: String,
              beforeDispatch: () throws -> Void) async throws -> TaskNoteEnvelope
}
