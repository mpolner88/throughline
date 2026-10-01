import Foundation

@MainActor struct TaskTransport: TaskTransporting {
    struct Authorization {
        var ownerID: String
        var token: String
        var generation: UUID
    }
    let baseURL: URL
    let session: URLSession
    let authorize: @MainActor (String) async throws -> Authorization
    let isCurrent: @MainActor (Authorization) -> Bool
    let reject: @MainActor (Authorization) -> Void

    init(baseURL: URL = BackendConfiguration.currentBaseURL, session: URLSession = .shared,
         authorize: @escaping @MainActor (String) async throws -> Authorization = TaskTransport.liveAuthorization,
         isCurrent: @escaping @MainActor (Authorization) -> Bool = TaskTransport.liveCurrent,
         reject: @escaping @MainActor (Authorization) -> Void = TaskTransport.liveReject) {
        self.baseURL = baseURL; self.session = session
        self.authorize = authorize; self.isCurrent = isCurrent; self.reject = reject
    }
    static func liveAuthorization(_ ownerID: String) async throws -> Authorization {
        guard let auth = try await AuthSessionRefresher.shared.validSession(), auth.user.id == ownerID else { throw TaskSyncError.signedOut }
        let snapshot = AuthSessionStore.snapshot
        guard snapshot.session?.user.id == ownerID, snapshot.session?.accessToken == auth.accessToken else { throw CancellationError() }
        return Authorization(ownerID: ownerID, token: auth.accessToken, generation: snapshot.generation)
    }
    static func liveCurrent(_ auth: Authorization) -> Bool {
        let current = AuthSessionStore.snapshot
        return current.generation == auth.generation && current.session?.user.id == auth.ownerID && current.session?.accessToken == auth.token
    }
    static func liveReject(_ auth: Authorization) {
        guard liveCurrent(auth) else { return }
        _ = AuthSessionStore.replace(nil, ifGeneration: auth.generation)
    }
    func list(ownerID: String) async throws -> TaskListResponse {
        for attempt in 0..<3 {
            do { return try await listAttempt(ownerID: ownerID) }
            catch TaskSyncError.snapshotChanged {
                if attempt == 2 { throw TaskSyncError.invalidResponse }
            }
        }
        throw TaskSyncError.invalidResponse
    }
    private func listAttempt(ownerID: String) async throws -> TaskListResponse {
        var assembled: TaskListResponse?
        var cursor: String?
        var seenCursors = Set<String>()
        var seenIDs = Set<String>()
        repeat {
            var components = URLComponents(url: baseURL.appendingPathComponent("tasks"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "limit", value: "200")]
            if let cursor { components.queryItems!.append(URLQueryItem(name: "cursor", value: cursor)) }
            let data = try await send(url: components.url!, ownerID: ownerID)
            let page = try JSONDecoder().decode(TaskListResponse.self, from: data)
            guard page.contractVersion == 1, page.snapshotVersion >= 0,
                  page.tasks.allSatisfy({ seenIDs.insert($0.id).inserted }) else { throw TaskSyncError.invalidResponse }
            if var current = assembled {
                guard current.snapshotVersion == page.snapshotVersion, current.cutoverAt == page.cutoverAt else { throw TaskSyncError.snapshotChanged }
                current.tasks.append(contentsOf: page.tasks)
                assembled = current
            } else { assembled = page }
            cursor = page.nextCursor
            if let cursor {
                guard seenCursors.insert(cursor).inserted, seenCursors.count <= 1000 else { throw TaskSyncError.invalidResponse }
            }
        } while cursor != nil
        guard var result = assembled else { throw TaskSyncError.invalidResponse }
        result.nextCursor = nil
        try TaskStore.validate(result.tasks)
        return result
    }
    func detail(recordingID: String, ownerID: String) async throws -> TaskNoteEnvelope {
        let data = try await send(url: baseURL.appendingPathComponent("recordings").appendingPathComponent(recordingID), ownerID: ownerID)
        return try decodeNote(data, recordingID: recordingID)
    }
    func mutate(occurrenceID: String, request: TaskMutationRequest, ownerID: String,
                beforeDispatch: () throws -> Void) async throws -> TaskMutationResponse {
        let data = try await send(url: baseURL.appendingPathComponent("tasks").appendingPathComponent(occurrenceID),
            ownerID: ownerID, body: JSONEncoder().encode(request), beforeDispatch: beforeDispatch)
        let result = try JSONDecoder().decode(TaskMutationResponse.self, from: data)
        guard result.mutationID == request.mutationID, result.task.id == occurrenceID else { throw TaskSyncError.invalidResponse }
        return result
    }
    func edit(recordingID: String, request: TaskEditRequest, ownerID: String,
              beforeDispatch: () throws -> Void) async throws -> TaskNoteEnvelope {
        let data = try await send(url: baseURL.appendingPathComponent("recordings").appendingPathComponent(recordingID),
            ownerID: ownerID, body: JSONEncoder().encode(request), beforeDispatch: beforeDispatch)
        let result = try decodeNote(data, recordingID: recordingID)
        guard result.mutationID == request.mutationID else { throw TaskSyncError.invalidResponse }
        return result
    }
    private func send(url: URL, ownerID: String, body: Data? = nil,
                      beforeDispatch: () throws -> Void = {}) async throws -> Data {
        let auth = try await authorize(ownerID)
        try Task.checkCancellation()
        guard auth.ownerID == ownerID, isCurrent(auth) else { throw CancellationError() }
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue("Bearer " + auth.token, forHTTPHeaderField: "Authorization")
        if let body {
            request.httpMethod = "PATCH"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        try beforeDispatch()
        try Task.checkCancellation()
        guard isCurrent(auth) else { throw CancellationError() }
        let (data, response) = try await session.data(for: request)
        try Task.checkCancellation()
        guard isCurrent(auth) else { throw CancellationError() }
        guard let status = (response as? HTTPURLResponse)?.statusCode else { throw TaskSyncError.invalidResponse }
        if status == 401 { reject(auth); throw TaskSyncError.signedOut }
        guard (200..<300).contains(status) else {
            let code = (try? JSONDecoder().decode(SafeError.self, from: data))?.errorCode ?? "unknown"
            switch code {
            case "version_conflict", "idempotency_conflict", "update_required": throw TaskSyncError.conflict
            case "task_deleted", "not_found": throw TaskSyncError.removed
            case "account_deletion_pending": throw TaskSyncError.deletionPending
            case "snapshot_changed": throw TaskSyncError.snapshotChanged
            default: throw TaskSyncError.server(status, code)
            }
        }
        return data
    }
    private struct SafeError: Decodable {
        let errorCode: String?
        enum CodingKeys: String, CodingKey { case errorCode = "error_code" }
    }
    private struct NoteWire: Decodable {
        var recording: RecordingPayload
        var currentRevisionID: String?
        var taskContractVersion: Int
        var taskRevision: Int64
        var snapshotVersion: Int64
        var tasks: [TaskOccurrence]
        var mutationID: String?
        enum CodingKeys: String, CodingKey {
            case recording, tasks
            case currentRevisionID = "current_revision_id", taskContractVersion = "task_contract_version"
            case taskRevision = "task_revision", snapshotVersion = "snapshot_version", mutationID = "mutation_id"
        }
    }
    private func decodeNote(_ data: Data, recordingID: String) throws -> TaskNoteEnvelope {
        let wire = try JSONDecoder().decode(NoteWire.self, from: data)
        guard wire.taskContractVersion == 1, wire.recording.id == recordingID, wire.taskRevision > 0,
              wire.snapshotVersion >= 0, wire.tasks.allSatisfy({ $0.recordingID == recordingID }) else { throw TaskSyncError.invalidResponse }
        try TaskStore.validate(wire.tasks)
        var note = wire.recording.displayNote()
        if note.currentRevisionID == nil { note.currentRevisionID = wire.currentRevisionID }
        note.taskContractVersion = 1
        note.taskRevision = wire.taskRevision
        return TaskNoteEnvelope(note: note, taskRevision: wire.taskRevision, snapshotVersion: wire.snapshotVersion,
            tasks: wire.tasks, mutationID: wire.mutationID)
    }
}
