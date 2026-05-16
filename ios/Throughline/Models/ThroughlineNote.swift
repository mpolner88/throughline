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
    var title: String
    var summary: String
    var transcript: String
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

    static let sample = ThroughlineNote(
        id: "sample-note",
        createdAt: Date(),
        type: .morning,
        title: "ship the small thing",
        summary: "Keep the morning light. Finish the first version, then walk again tonight and see what still feels true.",
        transcript: "I want to keep the morning light. Ship the small thing first, then walk again tonight and see what still feels true.",
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
