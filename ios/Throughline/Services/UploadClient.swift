import Foundation

enum BackendConfiguration {
    static let storageKey = "throughline.backendURL"
    static let apiTokenKey = "throughline.backendAPIToken"
    static let defaultBaseURLString = "https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api"
    static let localBaseURLString = "http://127.0.0.1:5180"
    private static let defaultBaseURL = URL(string: defaultBaseURLString)!

    static var currentBaseURL: URL {
        let rawValue = UserDefaults.standard.string(forKey: storageKey) ?? defaultBaseURLString
        return resolvedBaseURL(from: rawValue) ?? defaultBaseURL
    }

    static func resolvedBaseURL(from value: String) -> URL? {
        guard let url = normalizedURL(from: value) else { return nil }

        #if targetEnvironment(simulator)
        return canonicalSupabaseURL(url)
        #else
        return defaultBaseURL
        #endif
    }

    static var currentAPIToken: String? {
        apiToken(for: currentBaseURL)
    }

    static func apiToken(for baseURL: URL, storedValue: String? = UserDefaults.standard.string(forKey: apiTokenKey)) -> String? {
        #if DEBUG
        if isDefaultSupabaseHost(baseURL), let bundledAPIToken {
            return bundledAPIToken
        }

        let rawValue = storedValue ?? ""
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            return trimmed
        }

        return bundledAPIToken
        #else
        return nil
        #endif
    }

    static var hasBundledAPIToken: Bool {
        #if DEBUG
        bundledAPIToken != nil
        #else
        false
        #endif
    }

    static func normalizedURL(from value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let withScheme = trimmed.contains("://") ? trimmed : "http://\(trimmed)"
        guard var components = URLComponents(string: withScheme),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil
        else {
            return nil
        }

        let path = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.path = path.isEmpty ? "" : "/\(path)"
        return components.url
    }

    private static var bundledAPIToken: String? {
        #if DEBUG
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "ThroughlineBackendAPIToken") as? String else {
            return nil
        }

        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("$(") else { return nil }
        return trimmed
        #else
        nil
        #endif
    }

    private static func isLocalDevelopmentURL(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }

    private static func isDefaultSupabaseHost(_ url: URL) -> Bool {
        url.host?.caseInsensitiveCompare(defaultBaseURL.host ?? "") == .orderedSame
    }

    private static func canonicalSupabaseURL(_ url: URL) -> URL {
        isDefaultSupabaseHost(url) ? defaultBaseURL : url
    }
}

struct UploadResponse: Decodable {
    let id: String
    let status: String
    let processingStatus: String
    let hasNote: Bool
    let recordingURL: String?
    let recording: RecordingPayload?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case processingStatus = "processing_status"
        case hasNote = "has_note"
        case recordingURL = "recording_url"
        case recording
    }

    var throughlineNote: ThroughlineNote? {
        recording?.throughlineNote
    }

    var displayNote: ThroughlineNote {
        if let recording {
            return recording.displayNote(fallbackProcessingStatus: processingStatus)
        }

        return ThroughlineNote(
            id: id,
            createdAt: Date(),
            type: .freeform,
            processingStatus: processingStatus,
            title: "voice note captured",
            summary: Self.summary(for: processingStatus),
            transcript: "Recording uploaded. Extraction will replace this placeholder.",
            mostImportant: [],
            actionItems: [],
            todos: [],
            priorities: [],
            intentions: [],
            accomplishments: [],
            tomorrowTodos: [],
            mood: nil,
            tags: [processingStatus],
            people: [],
            projects: [],
            centersOfBalance: []
        )
    }

    fileprivate static func summary(for processingStatus: String) -> String {
        switch processingStatus {
        case "uploaded":
            "Your recording was saved and is waiting to be translated."
        case "needs_transcript":
            "Your recording was saved. Throughline is waiting for a transcript."
        case "needs_extractor":
            "Your recording has a transcript and is waiting for memory extraction."
        case "transcription_failed":
            "Your recording was saved, but transcription failed. The audio is still stored."
        case "extraction_failed":
            "Your recording was saved, but memory extraction failed. The transcript is still stored."
        case "processing_failed":
            "Your recording was saved, but processing failed. The audio is still stored."
        case "processed":
            "Your note was saved to Throughline."
        default:
            "Your note was uploaded to Throughline."
        }
    }
}

struct RecordingPayload: Decodable {
    let id: String
    let createdAt: String
    let type: RecordingType?
    let processingStatus: String?
    let transcriptRaw: String?
    let structuredNote: StructuredNotePayload?
    var currentRevisionID: String?
    var captureID: String?

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case type
        case processingStatus = "processing_status"
        case transcriptRaw = "transcript_raw"
        case structuredNote = "structured_note"
        case currentRevisionID = "current_revision_id"
        case captureID = "capture_id"
    }

    var throughlineNote: ThroughlineNote? {
        guard let structuredNote else { return nil }

        let normalizedTitle = structuredNote.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackTitle = structuredNote.mostImportant.first
            ?? structuredNote.priorities.first
            ?? structuredNote.todos.first?.text
            ?? structuredNote.actionItems.first?.text
            ?? "voice note"
        let title = normalizedTitle.isEmpty ? fallbackTitle : normalizedTitle

        let normalizedSummary = structuredNote.summary.trimmingCharacters(in: .whitespacesAndNewlines)
        let summaryCandidates = structuredNote.mostImportant
            + structuredNote.priorities
            + structuredNote.todos.map(\.text)
            + structuredNote.actionItems.map(\.text)
        let fallbackSummary = Array(summaryCandidates.prefix(2)).joined(separator: ". ")
        let summary = normalizedSummary.isEmpty
            ? (fallbackSummary.isEmpty ? title : fallbackSummary)
            : normalizedSummary

        return ThroughlineNote(
            id: id,
            createdAt: createdAtDate,
            type: structuredNote.type ?? type ?? .freeform,
            processingStatus: processingStatus,
            currentRevisionID: currentRevisionID,
            title: title,
            summary: summary,
            transcript: transcriptRaw ?? "",
            mostImportant: structuredNote.mostImportant,
            actionItems: structuredNote.actionItems,
            todos: structuredNote.todos,
            priorities: structuredNote.priorities,
            intentions: structuredNote.intentions,
            accomplishments: structuredNote.accomplishments,
            tomorrowTodos: structuredNote.tomorrowTodos,
            mood: structuredNote.mood,
            tags: structuredNote.tags,
            people: structuredNote.people,
            projects: structuredNote.projects,
            centersOfBalance: structuredNote.centersOfBalance,
            captureID: captureID
        )
    }

    var createdAtDate: Date {
        Self.date(from: createdAt) ?? Date()
    }

    func displayNote(fallbackProcessingStatus: String? = nil) -> ThroughlineNote {
        if let throughlineNote {
            return throughlineNote
        }

        let status = processingStatus ?? fallbackProcessingStatus ?? "uploaded"
        return ThroughlineNote(
            id: id,
            createdAt: createdAtDate,
            type: type ?? .freeform,
            processingStatus: status,
            currentRevisionID: currentRevisionID,
            title: "voice note captured",
            summary: UploadResponse.summary(for: status),
            transcript: transcriptRaw ?? "Recording saved. Transcript will appear here after processing.",
            mostImportant: [],
            actionItems: [],
            todos: [],
            priorities: [],
            intentions: [],
            accomplishments: [],
            tomorrowTodos: [],
            mood: nil,
            tags: [status],
            people: [],
            projects: [],
            centersOfBalance: [],
            captureID: captureID
        )
    }

    private static func date(from isoString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: isoString) {
            return date
        }

        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: isoString)
    }
}

struct StructuredNotePayload: Decodable {
    let type: RecordingType?
    let title: String
    let summary: String
    let mostImportant: [String]
    let actionItems: [ActionItem]
    let todos: [Todo]
    let priorities: [String]
    let intentions: [String]
    let accomplishments: [String]
    let tomorrowTodos: [String]
    let mood: Mood?
    let people: [String]
    let projects: [String]
    let tags: [String]
    let centersOfBalance: [String]

    enum CodingKeys: String, CodingKey {
        case type
        case title
        case summary
        case mostImportant = "most_important"
        case actionItems = "action_items"
        case todos
        case priorities
        case intentions
        case accomplishments
        case tomorrowTodos = "tomorrow_todos"
        case mood
        case people
        case projects
        case tags
        case centersOfBalance = "centers_of_balance"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decodeIfPresent(RecordingType.self, forKey: .type)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "voice note"
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        mostImportant = try container.decodeIfPresent([String].self, forKey: .mostImportant) ?? []
        actionItems = try container.decodeIfPresent([ActionItem].self, forKey: .actionItems) ?? []
        todos = try container.decodeIfPresent([Todo].self, forKey: .todos) ?? []
        priorities = try container.decodeIfPresent([String].self, forKey: .priorities) ?? []
        intentions = try container.decodeIfPresent([String].self, forKey: .intentions) ?? []
        accomplishments = try container.decodeIfPresent([String].self, forKey: .accomplishments) ?? []
        tomorrowTodos = try container.decodeIfPresent([String].self, forKey: .tomorrowTodos) ?? []
        mood = try container.decodeIfPresent(Mood.self, forKey: .mood)
        people = try container.decodeIfPresent([String].self, forKey: .people) ?? []
        projects = try container.decodeIfPresent([String].self, forKey: .projects) ?? []
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        centersOfBalance = try container.decodeIfPresent([String].self, forKey: .centersOfBalance) ?? []
    }
}

struct HealthResponse: Decodable {
    let ok: Bool
    let service: String?
    let storage: String?
    let authRequired: Bool?
    let authenticated: Bool?

    enum CodingKeys: String, CodingKey {
        case ok
        case service
        case storage
        case authRequired = "auth_required"
        case authenticated
    }
}

struct RecordingListResponse: Decodable {
    let recordings: [RecordingListItem]
    let count: Int
}

struct RecordingListItem: Decodable {
    let id: String
    let createdAt: String
    let type: RecordingType?
    let processingStatus: String
    let hasNote: Bool
    let hasAudio: Bool?
    let hasTranscript: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case type
        case processingStatus = "processing_status"
        case hasNote = "has_note"
        case hasAudio = "has_audio"
        case hasTranscript = "has_transcript"
    }
}

struct RecordingDetailResponse: Decodable {
    var recording: RecordingPayload
    let currentRevisionID: String?

    enum CodingKeys: String, CodingKey {
        case recording
        case currentRevisionID = "current_revision_id"
    }

    var resolvedRecording: RecordingPayload {
        var value = recording
        if value.currentRevisionID == nil { value.currentRevisionID = currentRevisionID }
        return value
    }
}

struct EvaluationReadinessPreviewResponse: Decodable {
    let preview: AgentReadinessPreview
}

struct EvaluationContributionResponse: Decodable {
    let evaluationID: String
    let evaluatedRevisionID: String
    let contributionID: String
    let eligible: Bool
    let idempotent: Bool

    enum CodingKeys: String, CodingKey {
        case evaluationID = "evaluation_id"
        case evaluatedRevisionID = "evaluated_revision_id"
        case contributionID = "contribution_id"
        case eligible, idempotent
    }
}

struct EvaluationContributionRemovalResponse: Decodable {
    let withdrawn: Bool
    let audioDeleted: Bool
    let idempotent: Bool

    enum CodingKeys: String, CodingKey {
        case withdrawn
        case audioDeleted = "audio_deleted"
        case idempotent
    }
}

struct AgentTokenSummary: Identifiable, Decodable {
    let id: String
    let name: String
    let createdAt: String?
    let lastUsedAt: String?
    let revokedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case createdAt = "created_at"
        case lastUsedAt = "last_used_at"
        case revokedAt = "revoked_at"
    }
}

struct AgentTokenListResponse: Decodable {
    let tokens: [AgentTokenSummary]
    let count: Int
}

struct AgentTokenCreateResponse: Decodable {
    let id: String?
    let name: String
    let token: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case token
        case createdAt = "created_at"
    }
}

enum RecordingProcessingMode: String {
    case sync
    case async
}

enum ProductFeedbackCategory: String, CaseIterable, Identifiable {
    case general
    case idea
    case problem
    case praise

    var id: String { rawValue }

    var label: String {
        switch self {
        case .general: "General"
        case .idea: "Idea"
        case .problem: "Something’s wrong"
        case .praise: "Something I love"
        }
    }
}

struct ProductFeedbackResponse: Decodable {
    let id: String
    let status: String
}

enum ProductAnalytics {
    private static let firstOpenedAtKey = "throughline.analytics.firstOpenedAt"

    static func track(
        _ eventName: String,
        properties: [String: String] = [:],
        recordingID: String? = nil
    ) {
        guard !isPreviewLaunch else { return }

        let ownerID = AuthSessionStore.currentSession?.user.id
        Task {
            await ProductEventQueue.shared.enqueue(
                eventName: eventName,
                properties: properties,
                recordingID: recordingID,
                ownerID: ownerID
            )
        }
    }

    static func trackFirstOpen(route: String) {
        guard !isPreviewLaunch,
              UserDefaults.standard.string(forKey: firstOpenedAtKey) == nil
        else {
            return
        }

        let timestamp = ISO8601DateFormatter().string(from: Date())
        UserDefaults.standard.set(timestamp, forKey: firstOpenedAtKey)
        track("first_opened", properties: ["route": route])
    }

    static func flush() {
        Task {
            await ProductEventQueue.shared.flush()
        }
    }

    private static var isPreviewLaunch: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains(where: {
            $0.hasPrefix("--throughline-preview-") || $0 == "--throughline-onboarding-step"
        })
        #else
        false
        #endif
    }
}

private actor ProductEventQueue {
    static let shared = ProductEventQueue()
    private struct OwnedEvent: Codable {
        let ownerID: String?
        let event: ProductEvent
    }
    private static let storageKey = "throughline.pendingOwnedProductEvents"
    private static let sessionID = UUID().uuidString.lowercased()
    private var pendingEvents: [OwnedEvent]
    private var isFlushing = false

    init() {
        let data = UserDefaults.standard.data(forKey: Self.storageKey)
        pendingEvents = data.flatMap { try? JSONDecoder().decode([OwnedEvent].self, from: $0) } ?? []
        // The legacy queue had no owner binding. Never adopt recording references under today's account.
        // Leave unbound legacy storage preserved; it cannot safely be sent under a new owner.
    }

    func enqueue(eventName: String, properties: [String: String], recordingID: String?, ownerID: String?) async {
        let channel = await ProductEventAttribution.currentDistributionChannel()
        let event = ProductEvent(id: "evt_" + UUID().uuidString.lowercased(), eventName: eventName,
            sessionID: Self.sessionID, occurredAt: ISO8601DateFormatter().string(from: Date()),
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            buildNumber: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String,
            distributionChannel: channel, recordingID: recordingID, properties: properties)
        pendingEvents.append(OwnedEvent(ownerID: ownerID, event: event))
        persist()
        await flush()
    }

    func flush() async {
        guard !isFlushing else { return }
        isFlushing = true
        defer { isFlushing = false }
        let owner = AuthSessionStore.currentSession?.user.id
        // A singleton send isolates permanent 403 ownership loss without sacrificing adjacent events.
        for pending in pendingEvents where pending.ownerID == owner {
            guard AuthSessionStore.currentSession?.user.id == owner else { return }
            do {
                try await UploadClient().sendProductEvents([pending.event], ownerID: owner, anonymousOnly: owner == nil)
            } catch let UploadClientError.serverError(status, _) where (400..<500).contains(status) && status != 401 && status != 429 {
                // Permanent rejection: retire only this event and continue.
            } catch { return }
            pendingEvents.removeAll { $0.event.id == pending.event.id }
            persist()
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(pendingEvents) else { return }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }
}

struct UploadClient {
    var baseURL = BackendConfiguration.currentBaseURL
    var apiToken = BackendConfiguration.currentAPIToken
    private let session: URLSession
    private let aiPermission: AIProcessingPermission

    init(
        baseURL: URL = BackendConfiguration.currentBaseURL,
        apiToken: String? = BackendConfiguration.currentAPIToken,
        session: URLSession = .shared,
        aiPermission: AIProcessingPermission = .shared
    ) {
        self.baseURL = baseURL
        self.apiToken = apiToken
        self.session = session
        self.aiPermission = aiPermission
    }

    func health() async throws -> HealthResponse {
        let request = try await authorizedRequest(url: baseURL.appendingPathComponent("health"))
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(HealthResponse.self, from: data)
    }

    func uploadDemoRecording(
        fileURL: URL,
        duration: Int,
        type: RecordingType
    ) async throws -> UploadResponse {
        var request = URLRequest(url: baseURL
            .appendingPathComponent("demo")
            .appendingPathComponent("recordings"))
        request.httpMethod = "POST"
        request.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        request.setValue(String(duration), forHTTPHeaderField: "X-Throughline-Duration-Seconds")
        request.setValue(TimeZone.current.identifier, forHTTPHeaderField: "X-Throughline-Timezone")
        request.setValue(type.rawValue, forHTTPHeaderField: "X-Throughline-Recording-Type")
        request.setValue(Self.localTimestamp(), forHTTPHeaderField: "X-Throughline-User-Local-Time")
        request.httpBody = try Data(contentsOf: fileURL)

        let (data, response) = try await aiPermission.data(for: request, session: session)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(UploadResponse.self, from: data)
    }

    func uploadRecording(
        fileURL: URL,
        duration: Int,
        type: RecordingType,
        processingMode: RecordingProcessingMode = .sync
    ) async throws -> UploadResponse {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("recordings"))
        request.httpMethod = "POST"
        request.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        request.setValue(String(duration), forHTTPHeaderField: "X-Throughline-Duration-Seconds")
        request.setValue(TimeZone.current.identifier, forHTTPHeaderField: "X-Throughline-Timezone")
        request.setValue(type.rawValue, forHTTPHeaderField: "X-Throughline-Recording-Type")
        request.setValue(processingMode.rawValue, forHTTPHeaderField: "X-Throughline-Processing-Mode")
        request.setValue(Self.localTimestamp(), forHTTPHeaderField: "X-Throughline-User-Local-Time")
        request.httpBody = try Data(contentsOf: fileURL)

        let (data, response) = try await aiPermission.data(for: request, session: session)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(UploadResponse.self, from: data)
    }

    func saveDemoNote(_ note: ThroughlineNote, duration: Int) async throws -> UploadResponse {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("recordings"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            DemoNoteSaveRequest(
                transcript: note.transcript,
                duration: duration,
                type: note.type.rawValue,
                userLocalTime: Self.localTimestamp(),
                timezone: TimeZone.current.identifier
            )
        )

        let (data, response) = try await aiPermission.data(for: request, session: session)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(UploadResponse.self, from: data)
    }

    func listNotes() async throws -> [ThroughlineNote] {
        let listRequest = try await authorizedRequest(url: baseURL.appendingPathComponent("recordings"))
        let (listData, listResponse) = try await session.data(for: listRequest)
        try validate(response: listResponse, data: listData)

        let list = try JSONDecoder().decode(RecordingListResponse.self, from: listData)
        var notes: [ThroughlineNote] = []

        for item in list.recordings {
            let detail = try await recording(id: item.id)
            notes.append(detail.displayNote(fallbackProcessingStatus: item.processingStatus))
        }

        return notes.sorted { $0.createdAt > $1.createdAt }
    }

    func recording(id: String) async throws -> RecordingPayload {
        let request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(id))
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(RecordingDetailResponse.self, from: data).resolvedRecording
    }

    func deleteRecording(id: String) async throws {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(id))
        request.httpMethod = "DELETE"

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
    }

    func updateActionItem(recordingID: String, text: String, isCompleted: Bool) async throws -> RecordingPayload {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(recordingID)
            .appendingPathComponent("action-items"))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            ActionItemUpdateRequest(text: text, completed: isCompleted)
        )

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(RecordingDetailResponse.self, from: data).resolvedRecording
    }

    func updateRecording(recordingID: String, draft: NoteEditDraft, expectedRevisionID: String?) async throws -> RecordingPayload {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(recordingID))
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(RecordingEditRequest(draft: draft, expectedRevisionID: expectedRevisionID))

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(RecordingDetailResponse.self, from: data).resolvedRecording
    }

    func evaluationReadinessPreview(recordingID: String, revisionID: String) async throws -> AgentReadinessPreview {
        var components = URLComponents(url: baseURL.appendingPathComponent("recordings").appendingPathComponent(recordingID).appendingPathComponent("evaluation-readiness-preview"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "revision_id", value: revisionID.lowercased())]
        guard let url = components?.url else { throw UploadClientError.invalidResponse }
        let request = try await authorizedRequest(url: url)
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(EvaluationReadinessPreviewResponse.self, from: data).preview
    }

    func saveEvaluation(recordingID: String, request body: EvaluationContributionRequest) async throws -> EvaluationContributionResponse {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("recordings").appendingPathComponent(recordingID).appendingPathComponent("evaluations"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(EvaluationContributionResponse.self, from: data)
    }

    func removeEvaluationContribution(recordingID: String, idempotencyKey: UUID = UUID()) async throws -> EvaluationContributionRemovalResponse {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("recordings").appendingPathComponent(recordingID).appendingPathComponent("evaluation-contribution"))
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["idempotency_key": idempotencyKey.uuidString.lowercased()])
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(EvaluationContributionRemovalResponse.self, from: data)
    }

    func deleteAccount() async throws {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("account"))
        request.httpMethod = "DELETE"

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
    }

    func listAgentTokens() async throws -> [AgentTokenSummary] {
        let request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("agent")
            .appendingPathComponent("tokens"))
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(AgentTokenListResponse.self, from: data).tokens
    }

    func createAgentToken(name: String) async throws -> AgentTokenCreateResponse {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("agent")
            .appendingPathComponent("tokens"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(CreateAgentTokenRequest(name: name))

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(AgentTokenCreateResponse.self, from: data)
    }

    func revokeAgentToken(id: String) async throws {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("agent")
            .appendingPathComponent("tokens")
            .appendingPathComponent(id))
        request.httpMethod = "DELETE"

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
    }

    func sendFeedback(
        recordingID: String,
        qualityScore: Int,
        issueTypes: [String] = [],
        correction: String? = nil,
        shouldRemember: Bool = true
    ) async throws -> FeedbackResponse {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(recordingID)
            .appendingPathComponent("feedback"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            FeedbackRequest(
                qualityScore: qualityScore,
                shouldRemember: shouldRemember,
                issueTypes: issueTypes,
                correction: correction
            )
        )

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(FeedbackResponse.self, from: data)
    }

    func sendProductEvents(_ events: [ProductEvent], ownerID: String? = nil, anonymousOnly: Bool = false) async throws {
        guard !events.isEmpty else { return }

        var request: URLRequest
        if let ownerID {
            guard let auth = try await AuthSessionRefresher.shared.validSession(), auth.user.id == ownerID,
                  AuthSessionStore.currentSession?.user.id == ownerID else { throw CancellationError() }
            request = URLRequest(url: baseURL.appendingPathComponent("events"))
            request.setValue("Bearer " + auth.accessToken, forHTTPHeaderField: "Authorization")
        } else if anonymousOnly {
            guard AuthSessionStore.currentSession == nil else { throw CancellationError() }
            request = URLRequest(url: baseURL.appendingPathComponent("events"))
        } else {
            request = try await authorizedRequest(url: baseURL.appendingPathComponent("events"))
        }
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ProductEventBatchRequest(events: events))

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
    }

    func sendProductFeedback(
        category: ProductFeedbackCategory,
        message: String,
        contactAllowed: Bool
    ) async throws -> ProductFeedbackResponse {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("product-feedback"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            ProductFeedbackRequest(
                category: category.rawValue,
                message: message,
                contactAllowed: contactAllowed,
                appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
                buildNumber: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String,
                context: ["surface": "settings"]
            )
        )

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(ProductFeedbackResponse.self, from: data)
    }

    private func authorizedRequest(url: URL) async throws -> URLRequest {
        var request = URLRequest(url: url)
        if let session = try await AuthSessionRefresher.shared.validSession() {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            return request
        }

        if let apiToken {
            request.setValue("Bearer \(apiToken)", forHTTPHeaderField: "Authorization")
            request.setValue(apiToken, forHTTPHeaderField: "X-Throughline-Api-Key")
        }
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw UploadClientError.invalidResponse
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw UploadClientError.serverError(httpResponse.statusCode, body)
        }
    }

    private static func localTimestamp() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone.current
        return formatter.string(from: Date())
    }
}

private struct FeedbackRequest: Encodable {
    let qualityScore: Int
    let shouldRemember: Bool
    let issueTypes: [String]
    let correction: String?
    let source = "ios_extraction_quality"
    let rubricVersion = "extraction_quality_v1"

    enum CodingKeys: String, CodingKey {
        case qualityScore = "quality_score"
        case shouldRemember = "should_remember"
        case issueTypes = "issue_types"
        case correction
        case source
        case rubricVersion = "rubric_version"
    }
}

private struct ProductEventBatchRequest: Encodable {
    let events: [ProductEvent]
}

private struct DemoNoteSaveRequest: Encodable {
    let transcript: String
    let duration: Int
    let type: String
    let userLocalTime: String
    let timezone: String

    enum CodingKeys: String, CodingKey {
        case transcript = "transcript_raw"
        case duration = "duration_seconds"
        case type
        case userLocalTime = "user_local_time"
        case timezone
    }
}

private struct ProductFeedbackRequest: Encodable {
    let category: String
    let message: String
    let contactAllowed: Bool
    let appVersion: String?
    let buildNumber: String?
    let context: [String: String]

    enum CodingKeys: String, CodingKey {
        case category
        case message
        case contactAllowed = "contact_allowed"
        case appVersion = "app_version"
        case buildNumber = "build_number"
        case context
    }
}

private struct ActionItemUpdateRequest: Encodable {
    let text: String
    let completed: Bool
}

private struct CreateAgentTokenRequest: Encodable {
    let name: String
}

private struct RecordingEditRequest: Encodable {
    let title: String
    let summary: String
    let transcript: String
    let mostImportant: [String]
    let todos: [String]
    let expectedCurrentRevisionID: String?
    let idempotencyKey: String?
    let noticeVersion: String?
    let disclosureVersion: String?
    let policyVersion: String?

    enum CodingKeys: String, CodingKey {
        case title
        case summary
        case transcript
        case mostImportant = "most_important"
        case todos
        case expectedCurrentRevisionID = "expected_current_revision_id"
        case idempotencyKey = "idempotency_key"
        case noticeVersion = "notice_version"
        case disclosureVersion = "disclosure_version"
        case policyVersion = "policy_version"
    }

    init(draft: NoteEditDraft, expectedRevisionID: String?) {
        title = draft.trimmedTitle
        summary = draft.trimmedSummary
        transcript = draft.trimmedTranscript
        mostImportant = draft.mostImportant
        todos = draft.todos
        expectedCurrentRevisionID = expectedRevisionID?.lowercased()
        idempotencyKey = expectedRevisionID == nil ? nil : UUID().uuidString.lowercased()
        noticeVersion = expectedRevisionID == nil ? nil : EvaluationContributionRequest.noticeVersion
        disclosureVersion = expectedRevisionID == nil ? nil : EvaluationContributionRequest.disclosureVersion
        policyVersion = expectedRevisionID == nil ? nil : EvaluationContributionRequest.policyVersion
    }
}

struct FeedbackResponse: Decodable {
    let id: String
    let recordingID: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case recordingID = "recording_id"
        case status
    }
}

enum UploadClientError: LocalizedError {
    case invalidResponse
    case serverError(Int, String)
    case processingFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "The backend returned an invalid response."
        case let .processingFailed(status):
            "Throughline could not structure this recording (\(status)). Please try again."
        case let .serverError(status, body):
            if status == 401 {
                #if DEBUG
                "Backend token missing or incorrect. Open connect and check the API token."
                #else
                "Throughline could not authenticate with the backend."
                #endif
            } else {
                "The backend returned \(status). \(Self.message(from: body))"
            }
        }
    }

    private static func message(from body: String) -> String {
        guard let data = body.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let error = payload["error"] as? String
        else {
            return body
        }

        return error
    }
}
