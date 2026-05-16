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
            title: "voice note captured",
            summary: Self.summary(for: processingStatus),
            transcript: "Recording uploaded. Extraction will replace this placeholder.",
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

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case type
        case processingStatus = "processing_status"
        case transcriptRaw = "transcript_raw"
        case structuredNote = "structured_note"
    }

    var throughlineNote: ThroughlineNote? {
        guard let structuredNote else { return nil }

        return ThroughlineNote(
            id: id,
            createdAt: createdAtDate,
            type: structuredNote.type ?? type ?? .freeform,
            title: structuredNote.title,
            summary: structuredNote.summary,
            transcript: transcriptRaw ?? "",
            todos: structuredNote.todos,
            priorities: structuredNote.priorities,
            intentions: structuredNote.intentions,
            accomplishments: structuredNote.accomplishments,
            tomorrowTodos: structuredNote.tomorrowTodos,
            mood: structuredNote.mood,
            tags: structuredNote.tags,
            people: structuredNote.people,
            projects: structuredNote.projects,
            centersOfBalance: structuredNote.centersOfBalance
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
            title: "voice note captured",
            summary: UploadResponse.summary(for: status),
            transcript: transcriptRaw ?? "Recording saved. Transcript will appear here after processing.",
            todos: [],
            priorities: [],
            intentions: [],
            accomplishments: [],
            tomorrowTodos: [],
            mood: nil,
            tags: [status],
            people: [],
            projects: [],
            centersOfBalance: []
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
    let recording: RecordingPayload
}

enum RecordingProcessingMode: String {
    case sync
    case async
}

struct UploadClient {
    var baseURL = BackendConfiguration.currentBaseURL
    var apiToken = BackendConfiguration.currentAPIToken

    init(
        baseURL: URL = BackendConfiguration.currentBaseURL,
        apiToken: String? = BackendConfiguration.currentAPIToken
    ) {
        self.baseURL = baseURL
        self.apiToken = apiToken
    }

    func health() async throws -> HealthResponse {
        let request = try await authorizedRequest(url: baseURL.appendingPathComponent("health"))
        let (data, response) = try await URLSession.shared.data(for: request)
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

        let (data, response) = try await URLSession.shared.data(for: request)
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

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(UploadResponse.self, from: data)
    }

    func listNotes() async throws -> [ThroughlineNote] {
        let listRequest = try await authorizedRequest(url: baseURL.appendingPathComponent("recordings"))
        let (listData, listResponse) = try await URLSession.shared.data(for: listRequest)
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
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(RecordingDetailResponse.self, from: data).recording
    }

    func deleteRecording(id: String) async throws {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(id))
        request.httpMethod = "DELETE"

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    func deleteAccount() async throws {
        var request = try await authorizedRequest(url: baseURL.appendingPathComponent("account"))
        request.httpMethod = "DELETE"

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    func sendFeedback(recordingID: String, agentReady: Bool, shouldRemember: Bool) async throws -> FeedbackResponse {
        var request = try await authorizedRequest(url: baseURL
            .appendingPathComponent("recordings")
            .appendingPathComponent(recordingID)
            .appendingPathComponent("feedback"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            FeedbackRequest(agentReady: agentReady, shouldRemember: shouldRemember)
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(FeedbackResponse.self, from: data)
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
    let agentReady: Bool
    let shouldRemember: Bool

    enum CodingKeys: String, CodingKey {
        case agentReady = "agent_ready"
        case shouldRemember = "should_remember"
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

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "The backend returned an invalid response."
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
