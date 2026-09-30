import Foundation

enum RecordingType: String, Codable, CaseIterable, Identifiable {
    case morning
    case evening
    case weeklyReview = "weekly_review"
    case freeform

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .morning: "morning"
        case .evening: "evening"
        case .weeklyReview: "weekly review"
        case .freeform: "freeform"
        }
    }
}

enum Mood: String, Codable {
    case focused
    case energized
    case grateful
    case calm
    case anxious
    case frustrated
    case tired
    case sad
    case neutral
}

struct Todo: Identifiable, Codable, Hashable {
    var id = ""
    var text: String
    var status: String?
    var priority: String?
    var due: String?
    var forDate: String?
    var context: String?
    var completedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case status
        case priority
        case due
        case forDate = "for_date"
        case context
        case completedAt = "completed_at"
    }

    init(
        id: String = UUID().uuidString,
        text: String,
        status: String? = nil,
        priority: String?,
        due: String?,
        forDate: String?,
        context: String?,
        completedAt: String? = nil
    ) {
        self.id = id
        self.text = text
        self.status = status
        self.priority = priority
        self.due = due
        self.forDate = forDate
        self.context = context
        self.completedAt = completedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? ""
        text = try container.decode(String.self, forKey: .text)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        priority = try container.decodeIfPresent(String.self, forKey: .priority)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        forDate = try container.decodeIfPresent(String.self, forKey: .forDate)
        context = try container.decodeIfPresent(String.self, forKey: .context)
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
    }
}

struct ActionItem: Identifiable, Codable, Hashable {
    var id: String
    var text: String
    var status: String
    var source: String?
    var occurrenceID: String?
    var completedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case status
        case source
        case occurrenceID = "occurrence_id"
        case completedAt = "completed_at"
    }

    init(
        id: String = UUID().uuidString,
        text: String,
        status: String = "open",
        source: String? = nil,
        completedAt: String? = nil,
        occurrenceID: String? = nil
    ) {
        self.id = id
        self.text = text
        self.status = status
        self.source = source
        self.occurrenceID = occurrenceID
        self.completedAt = completedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decode(String.self, forKey: .text)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? Self.stableID(for: text)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "open"
        source = try container.decodeIfPresent(String.self, forKey: .source)
        occurrenceID = try container.decodeIfPresent(String.self, forKey: .occurrenceID)
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
    }

    var isCompleted: Bool {
        status == "completed" || status == "done"
    }

    private static func stableID(for text: String) -> String {
        let normalized = text
            .lowercased()
            .filter { $0.isLetter || $0.isNumber || $0.isWhitespace || $0 == "-" }
            .split(separator: " ")
            .joined(separator: "-")
        return normalized.isEmpty ? UUID().uuidString : String(normalized.prefix(80))
    }
}

struct ThroughlineNote: Identifiable, Codable, Hashable {
    var id: String
    var createdAt: Date
    var type: RecordingType
    var processingStatus: String?
    var currentRevisionID: String?
    var captureID: String?
    var taskContractVersion: Int?
    var taskRevision: Int64?
    var title: String
    var summary: String
    var transcript: String
    var mostImportant: [String]
    var actionItems: [ActionItem]
    var todos: [Todo]
    var priorities: [String]
    var intentions: [String]
    var accomplishments: [String]
    var tomorrowTodos: [String]
    var mood: Mood?
    var tags: [String]
    var people: [String]
    var projects: [String]
    var centersOfBalance: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt
        case type
        case processingStatus
        case currentRevisionID
        case captureID
        case taskContractVersion
        case taskRevision
        case title
        case summary
        case transcript
        case mostImportant
        case actionItems
        case todos
        case priorities
        case intentions
        case accomplishments
        case tomorrowTodos
        case mood
        case tags
        case people
        case projects
        case centersOfBalance
    }

    init(
        id: String,
        createdAt: Date,
        type: RecordingType,
        processingStatus: String? = nil,
        currentRevisionID: String? = nil,
        title: String,
        summary: String,
        transcript: String,
        mostImportant: [String] = [],
        actionItems: [ActionItem] = [],
        todos: [Todo],
        priorities: [String],
        intentions: [String],
        accomplishments: [String],
        tomorrowTodos: [String],
        mood: Mood?,
        tags: [String],
        people: [String],
        projects: [String],
        centersOfBalance: [String],
        captureID: String? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.type = type
        self.processingStatus = processingStatus
        self.currentRevisionID = currentRevisionID
        self.captureID = captureID
        self.title = title
        self.summary = summary
        self.transcript = transcript
        self.mostImportant = mostImportant
        self.actionItems = actionItems
        self.todos = todos
        self.priorities = priorities
        self.intentions = intentions
        self.accomplishments = accomplishments
        self.tomorrowTodos = tomorrowTodos
        self.mood = mood
        self.tags = tags
        self.people = people
        self.projects = projects
        self.centersOfBalance = centersOfBalance
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        type = try container.decodeIfPresent(RecordingType.self, forKey: .type) ?? .freeform
        processingStatus = try container.decodeIfPresent(String.self, forKey: .processingStatus)
        currentRevisionID = try container.decodeIfPresent(String.self, forKey: .currentRevisionID)
        captureID = try container.decodeIfPresent(String.self, forKey: .captureID)
        taskContractVersion = try container.decodeIfPresent(Int.self, forKey: .taskContractVersion)
        taskRevision = try container.decodeIfPresent(Int64.self, forKey: .taskRevision)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "voice note"
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        transcript = try container.decodeIfPresent(String.self, forKey: .transcript) ?? ""
        mostImportant = try container.decodeIfPresent([String].self, forKey: .mostImportant) ?? []
        actionItems = try container.decodeIfPresent([ActionItem].self, forKey: .actionItems) ?? []
        todos = try container.decodeIfPresent([Todo].self, forKey: .todos) ?? []
        priorities = try container.decodeIfPresent([String].self, forKey: .priorities) ?? []
        intentions = try container.decodeIfPresent([String].self, forKey: .intentions) ?? []
        accomplishments = try container.decodeIfPresent([String].self, forKey: .accomplishments) ?? []
        tomorrowTodos = try container.decodeIfPresent([String].self, forKey: .tomorrowTodos) ?? []
        mood = try container.decodeIfPresent(Mood.self, forKey: .mood)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        people = try container.decodeIfPresent([String].self, forKey: .people) ?? []
        projects = try container.decodeIfPresent([String].self, forKey: .projects) ?? []
        centersOfBalance = try container.decodeIfPresent([String].self, forKey: .centersOfBalance) ?? []
    }

    var isProcessing: Bool {
        guard let processingStatus else { return false }
        return !["processed", "transcription_failed", "extraction_failed", "processing_failed"].contains(processingStatus)
    }

    var processingText: String? {
        guard let processingStatus, processingStatus != "processed" else { return nil }

        switch processingStatus {
        case "uploaded":
            return "Saving audio"
        case "needs_transcript":
            return "Waiting for transcript"
        case "needs_extractor":
            return "Waiting for extraction"
        case "transcription_failed":
            return "Transcription failed"
        case "extraction_failed":
            return "Extraction failed"
        case "processing_failed":
            return "Processing failed"
        default:
            return "Processing"
        }
    }

    var previewText: String {
        let transcriptText = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if !transcriptText.isEmpty && !isPlaceholderTranscript(transcriptText) {
            return transcriptText
        }

        return summary
    }

    var displayMostImportant: [String] {
        var values: [String] = []
        appendUnique(mostImportant, to: &values)
        appendUnique(priorities, to: &values)
        appendUnique(todos.filter { $0.priority == "high" }.map(\.text), to: &values)
        appendUnique(tomorrowTodos, to: &values)
        appendUnique(intentions, to: &values)
        appendUnique(accomplishments, to: &values)

        if values.isEmpty && !summary.isEmpty && processingStatus == "processed" {
            values.append(summary)
        }

        return Array(values.prefix(5))
    }

    var displayImportantActionItems: [ActionItem] {
        // Only actual to-dos are actionable. Prose and repeated text never supply identity.
        todos.enumerated().map { index, todo in
            let occurrence = taskContractVersion == 1 && !todo.id.isEmpty ? todo.id : nil
            return ActionItem(id: occurrence ?? "display-\(id)-\(index)", text: todo.text,
                status: todo.status ?? "open", source: "todo", completedAt: todo.completedAt,
                occurrenceID: occurrence)
        }
    }

    private func appendUnique(_ candidates: [String], to values: inout [String]) {
        for candidate in candidates {
            let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            let key = trimmed.lowercased()
            guard !values.contains(where: { $0.lowercased() == key }) else { continue }
            values.append(trimmed)
        }
    }

    private func isPlaceholderTranscript(_ text: String) -> Bool {
        text.localizedCaseInsensitiveContains("transcript will appear")
            || text.localizedCaseInsensitiveContains("extraction will replace")
    }

    private static func normalizedText(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func stableActionID(for text: String) -> String {
        let normalized = normalizedText(text)
            .filter { $0.isLetter || $0.isNumber || $0.isWhitespace || $0 == "-" }
            .split(separator: " ")
            .joined(separator: "-")
        return normalized.isEmpty ? UUID().uuidString : String(normalized.prefix(80))
    }

    static let sample = ThroughlineNote(
        id: "sample-note",
        createdAt: Date(),
        type: .morning,
        title: "ship the small thing",
        summary: "Keep the morning light. Finish the first version, then walk again tonight and see what still feels true.",
        transcript: "I want to keep the morning light. Ship the small thing first, then walk again tonight and see what still feels true.",
        mostImportant: ["Ship the small thing first", "Walk again tonight"],
        actionItems: [
            ActionItem(text: "Ship the small thing first", source: "most_important"),
            ActionItem(text: "Walk again tonight", source: "most_important")
        ],
        todos: [
            Todo(text: "Ship the small thing first", priority: "high", due: nil, forDate: nil, context: nil),
            Todo(text: "Walk again tonight", priority: nil, due: nil, forDate: nil, context: nil)
        ],
        priorities: ["Ship the small thing first"],
        intentions: ["Keep the morning light"],
        accomplishments: [],
        tomorrowTodos: [],
        mood: .calm,
        tags: ["morning", "small version"],
        people: [],
        projects: ["throughline"],
        centersOfBalance: ["purpose", "profession"]
    )
}

struct TodoEditRow: Codable, Equatable, Identifiable {
    var id: String
    var occurrenceID: String?
    var clientItemID: String?
    var text: String
    var isCompleted: Bool

    init(newText: String = "") {
        let uuid = UUID().uuidString.lowercased()
        id = "new-" + uuid
        occurrenceID = nil
        clientItemID = uuid
        text = newText
        isCompleted = false
    }
    init(id: String, occurrenceID: String?, text: String, isCompleted: Bool) {
        self.id = id
        self.occurrenceID = occurrenceID
        clientItemID = nil
        self.text = text
        self.isCompleted = isCompleted
    }
}

struct NoteEditDraft: Codable, Equatable {
    var recordingID: String?
    var expectedTaskRevision: Int64?
    var title: String
    var summary: String
    var transcript: String
    var mostImportantText: String
    var todoRows: [TodoEditRow]

    init(title: String = "", summary: String = "", transcript: String = "",
         mostImportantText: String = "", todosText: String = "") {
        self.title = title
        self.summary = summary
        self.transcript = transcript
        self.mostImportantText = mostImportantText
        todoRows = todosText.components(separatedBy: .newlines).filter { !$0.isEmpty }.map { TodoEditRow(newText: $0) }
    }
    init(note: ThroughlineNote) {
        recordingID = note.id
        expectedTaskRevision = note.taskRevision
        title = note.title
        summary = note.summary
        transcript = note.transcript
        mostImportantText = note.displayMostImportant.joined(separator: "\n")
        todoRows = note.todos.enumerated().map { index, todo in
            let occurrence = note.taskContractVersion == 1 && !todo.id.isEmpty ? todo.id : nil
            return TodoEditRow(id: occurrence ?? "unknown-\(index)", occurrenceID: occurrence,
                text: todo.text, isCompleted: todo.status == "completed" || todo.status == "done")
        }
    }
    var trimmedTitle: String { title.trimmingCharacters(in: .whitespacesAndNewlines) }
    var trimmedSummary: String { summary.trimmingCharacters(in: .whitespacesAndNewlines) }
    var trimmedTranscript: String { transcript.trimmingCharacters(in: .whitespacesAndNewlines) }
    var mostImportant: [String] { Self.lines(from: mostImportantText) }
    var todos: [String] { todoRows.map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty } }
    // Compatibility accessor for the old form while UI integration replaces that field.
    var todosText: String {
        get { todoRows.map(\.text).joined(separator: "\n") }
        set { todoRows = newValue.components(separatedBy: .newlines).map { TodoEditRow(newText: $0) } }
    }
    var canSave: Bool { !trimmedTitle.isEmpty }
    private static func lines(from text: String) -> [String] {
        var seen = Set<String>()
        return text.components(separatedBy: .newlines).compactMap { line in
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, seen.insert(trimmed.lowercased()).inserted else { return nil }
            return trimmed
        }
    }
}
