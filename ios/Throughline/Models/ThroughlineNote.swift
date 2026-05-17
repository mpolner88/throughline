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
    var id = UUID().uuidString
    var text: String
    var priority: String?
    var due: String?
    var forDate: String?
    var context: String?

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case priority
        case due
        case forDate = "for_date"
        case context
    }

    init(
        id: String = UUID().uuidString,
        text: String,
        priority: String?,
        due: String?,
        forDate: String?,
        context: String?
    ) {
        self.id = id
        self.text = text
        self.priority = priority
        self.due = due
        self.forDate = forDate
        self.context = context
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        text = try container.decode(String.self, forKey: .text)
        priority = try container.decodeIfPresent(String.self, forKey: .priority)
        due = try container.decodeIfPresent(String.self, forKey: .due)
        forDate = try container.decodeIfPresent(String.self, forKey: .forDate)
        context = try container.decodeIfPresent(String.self, forKey: .context)
    }
}

struct ThroughlineNote: Identifiable, Codable, Hashable {
    var id: String
    var createdAt: Date
    var type: RecordingType
    var processingStatus: String?
    var title: String
    var summary: String
    var transcript: String
    var mostImportant: [String]
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
        case title
        case summary
        case transcript
        case mostImportant
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
        title: String,
        summary: String,
        transcript: String,
        mostImportant: [String] = [],
        todos: [Todo],
        priorities: [String],
        intentions: [String],
        accomplishments: [String],
        tomorrowTodos: [String],
        mood: Mood?,
        tags: [String],
        people: [String],
        projects: [String],
        centersOfBalance: [String]
    ) {
        self.id = id
        self.createdAt = createdAt
        self.type = type
        self.processingStatus = processingStatus
        self.title = title
        self.summary = summary
        self.transcript = transcript
        self.mostImportant = mostImportant
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
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "voice note"
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        transcript = try container.decodeIfPresent(String.self, forKey: .transcript) ?? ""
        mostImportant = try container.decodeIfPresent([String].self, forKey: .mostImportant) ?? []
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

    static let sample = ThroughlineNote(
        id: "sample-note",
        createdAt: Date(),
        type: .morning,
        title: "ship the small thing",
        summary: "Keep the morning light. Finish the first version, then walk again tonight and see what still feels true.",
        transcript: "I want to keep the morning light. Ship the small thing first, then walk again tonight and see what still feels true.",
        mostImportant: ["Ship the small thing first", "Walk again tonight"],
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
