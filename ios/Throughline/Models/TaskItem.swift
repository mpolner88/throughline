import Foundation

enum TaskBucket: String, Codable, CaseIterable, Identifiable {
    case today
    case thisWeek = "this_week"
    case later

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "today"
        case .thisWeek: "this week"
        case .later: "later"
        }
    }
}

enum TaskTimeframe: String, Codable {
    case today
    case thisWeek = "this_week"
    case later
}

struct TaskItem: Identifiable, Codable, Hashable {
    var id: String
    var text: String
    var status: String
    var bucket: TaskBucket
    var timeframe: TaskTimeframe?
    var due: String?
    var priority: String?
    var recordingID: String
    var recordingTitle: String
    var recordingCreatedAt: String
    var spokenIndex: Int
    var firstSeenLocalDate: String
    var carried: Bool
    var completedAt: String?
    var source: String

    enum CodingKeys: String, CodingKey {
        case id
        case text
        case status
        case bucket
        case timeframe
        case due
        case priority
        case recordingID = "recording_id"
        case recordingTitle = "recording_title"
        case recordingCreatedAt = "recording_created_at"
        case spokenIndex = "spoken_index"
        case firstSeenLocalDate = "first_seen_local_date"
        case carried
        case completedAt = "completed_at"
        case source
    }

    init(
        id: String,
        text: String,
        status: String = "open",
        bucket: TaskBucket,
        timeframe: TaskTimeframe? = nil,
        due: String? = nil,
        priority: String? = nil,
        recordingID: String,
        recordingTitle: String,
        recordingCreatedAt: String,
        spokenIndex: Int = 0,
        firstSeenLocalDate: String = "",
        carried: Bool = false,
        completedAt: String? = nil,
        source: String = "todo"
    ) {
        self.id = id
        self.text = text
        self.status = status
        self.bucket = bucket
        self.timeframe = timeframe
        self.due = due
        self.priority = priority
        self.recordingID = recordingID
        self.recordingTitle = recordingTitle
        self.recordingCreatedAt = recordingCreatedAt
        self.spokenIndex = spokenIndex
        self.firstSeenLocalDate = firstSeenLocalDate
        self.carried = carried
        self.completedAt = completedAt
        self.source = source
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decode(String.self, forKey: .text)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? Self.stableID(for: text)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "open"
        let bucketValue = try container.decodeIfPresent(String.self, forKey: .bucket) ?? ""
        bucket = TaskBucket(rawValue: bucketValue) ?? .later
        let timeframeValue = try container.decodeIfPresent(String.self, forKey: .timeframe)
        timeframe = timeframeValue.flatMap { TaskTimeframe(rawValue: $0) }
        due = try container.decodeIfPresent(String.self, forKey: .due)
        priority = try container.decodeIfPresent(String.self, forKey: .priority)
        recordingID = try container.decodeIfPresent(String.self, forKey: .recordingID) ?? ""
        recordingTitle = try container.decodeIfPresent(String.self, forKey: .recordingTitle) ?? ""
        recordingCreatedAt = try container.decodeIfPresent(String.self, forKey: .recordingCreatedAt) ?? ""
        spokenIndex = try container.decodeIfPresent(Int.self, forKey: .spokenIndex) ?? 0
        firstSeenLocalDate = try container.decodeIfPresent(String.self, forKey: .firstSeenLocalDate) ?? ""
        carried = try container.decodeIfPresent(Bool.self, forKey: .carried) ?? false
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
        source = try container.decodeIfPresent(String.self, forKey: .source) ?? "todo"
    }

    var isCompleted: Bool {
        status == "completed"
    }

    var isPriority: Bool {
        priority == "high"
    }

    var recordingCreatedDate: Date? {
        RecordingPayload.date(from: recordingCreatedAt)
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

struct TaskCounts: Codable, Hashable {
    var today: Int
    var thisWeek: Int
    var later: Int

    enum CodingKeys: String, CodingKey {
        case today
        case thisWeek = "this_week"
        case later
    }

    init(today: Int = 0, thisWeek: Int = 0, later: Int = 0) {
        self.today = today
        self.thisWeek = thisWeek
        self.later = later
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        today = try container.decodeIfPresent(Int.self, forKey: .today) ?? 0
        thisWeek = try container.decodeIfPresent(Int.self, forKey: .thisWeek) ?? 0
        later = try container.decodeIfPresent(Int.self, forKey: .later) ?? 0
    }

    func count(in bucket: TaskBucket) -> Int {
        switch bucket {
        case .today: today
        case .thisWeek: thisWeek
        case .later: later
        }
    }
}

struct TaskListResponse: Codable, Hashable {
    var date: String
    var weekEnd: String
    var today: [TaskItem]
    var thisWeek: [TaskItem]
    var later: [TaskItem]
    var done: [TaskItem]
    var counts: TaskCounts

    enum CodingKeys: String, CodingKey {
        case date
        case weekEnd = "week_end"
        case today
        case thisWeek = "this_week"
        case later
        case done
        case counts
    }

    init(
        date: String,
        weekEnd: String,
        today: [TaskItem] = [],
        thisWeek: [TaskItem] = [],
        later: [TaskItem] = [],
        done: [TaskItem] = [],
        counts: TaskCounts? = nil
    ) {
        self.date = date
        self.weekEnd = weekEnd
        self.today = today
        self.thisWeek = thisWeek
        self.later = later
        self.done = done
        self.counts = counts ?? TaskCounts(today: today.count, thisWeek: thisWeek.count, later: later.count)
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedDate = try container.decodeIfPresent(String.self, forKey: .date) ?? Self.localDate()
        date = decodedDate
        weekEnd = try container.decodeIfPresent(String.self, forKey: .weekEnd)
            ?? Self.weekEnd(containing: decodedDate)
            ?? decodedDate
        today = try container.decodeIfPresent([TaskItem].self, forKey: .today) ?? []
        thisWeek = try container.decodeIfPresent([TaskItem].self, forKey: .thisWeek) ?? []
        later = try container.decodeIfPresent([TaskItem].self, forKey: .later) ?? []
        done = try container.decodeIfPresent([TaskItem].self, forKey: .done) ?? []
        counts = try container.decodeIfPresent(TaskCounts.self, forKey: .counts)
            ?? TaskCounts(today: today.count, thisWeek: thisWeek.count, later: later.count)
    }

    static func empty(date: String, weekEnd: String) -> TaskListResponse {
        TaskListResponse(date: date, weekEnd: weekEnd)
    }

    func items(in bucket: TaskBucket) -> [TaskItem] {
        switch bucket {
        case .today: today
        case .thisWeek: thisWeek
        case .later: later
        }
    }

    // Applies the local day boundary without a server call: drops yesterday's
    // done group, recomputes each open item's bucket for the new date, and
    // re-sorts every tab the way GET /tasks does (spec sections 3.2, 4.2, 5).
    func rederived(for date: String) -> TaskListResponse {
        let weekEnd = Self.weekEnd(containing: date) ?? date
        var lists: [TaskBucket: [TaskItem]] = [.today: [], .thisWeek: [], .later: []]

        for var item in today + thisWeek + later where !item.isCompleted {
            item.carried = false

            if let due = item.due, Self.isISODate(due) {
                if due <= date {
                    item.bucket = .today
                } else if due <= weekEnd {
                    item.bucket = .thisWeek
                } else {
                    item.bucket = .later
                }

                if due < date {
                    item.carried = true
                    if let age = Self.days(from: due, to: date), age > Self.carryCeilingDays {
                        item.bucket = .later
                    }
                }
            } else {
                switch item.timeframe {
                case .today: item.bucket = .today
                case .thisWeek: item.bucket = .thisWeek
                case .later, .none: item.bucket = .later
                }
            }

            lists[item.bucket, default: []].append(item)
        }

        return TaskListResponse(
            date: date,
            weekEnd: weekEnd,
            today: Self.sorted(lists[.today] ?? [], in: .today),
            thisWeek: Self.sorted(lists[.thisWeek] ?? [], in: .thisWeek),
            later: Self.sorted(lists[.later] ?? [], in: .later),
            done: []
        )
    }

    // The fixed per-tab order from spec section 4.2.
    static func sorted(_ items: [TaskItem], in bucket: TaskBucket) -> [TaskItem] {
        switch bucket {
        case .today: items.sorted(by: todayPrecedes)
        case .thisWeek: items.sorted(by: thisWeekPrecedes)
        case .later: items.sorted(by: laterPrecedes)
        }
    }

    // MARK: - Local dates

    static var timeZoneIdentifier: String {
        TimeZone.current.identifier
    }

    static func localDate(_ date: Date = .now) -> String {
        dateFormatter.string(from: date)
    }

    // ISO date of the Sunday ending the Monday..Sunday week containing date.
    static func weekEnd(containing date: String) -> String? {
        guard let day = dateFormatter.date(from: date) else { return nil }

        // Calendar weekday is 1 = Sunday ... 7 = Saturday regardless of locale.
        let weekday = calendar.component(.weekday, from: day)
        let daysToSunday = (8 - weekday) % 7
        guard let sunday = calendar.date(byAdding: .day, value: daysToSunday, to: day) else { return nil }
        return dateFormatter.string(from: sunday)
    }

    // Whole days from earlier to later; negative when later precedes earlier.
    static func days(from earlier: String, to later: String) -> Int? {
        guard let start = dateFormatter.date(from: earlier),
              let end = dateFormatter.date(from: later)
        else {
            return nil
        }

        return calendar.dateComponents([.day], from: start, to: end).day
    }

    private static let carryCeilingDays = 7

    private static var calendar: Calendar {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone.current
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return calendar
    }

    private static var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private static func isISODate(_ value: String) -> Bool {
        value.count == 10 && dateFormatter.date(from: value) != nil
    }

    // MARK: - Sort comparators

    private static func todayPrecedes(_ lhs: TaskItem, _ rhs: TaskItem) -> Bool {
        if lhs.carried != rhs.carried {
            return lhs.carried
        }
        if lhs.isPriority != rhs.isPriority {
            return lhs.isPriority
        }
        return newerRecordingPrecedes(lhs, rhs)
    }

    private static func thisWeekPrecedes(_ lhs: TaskItem, _ rhs: TaskItem) -> Bool {
        switch (lhs.due, rhs.due) {
        case let (lhsDue?, rhsDue?) where lhsDue != rhsDue:
            return lhsDue < rhsDue
        case (.some, .none):
            return true
        case (.none, .some):
            return false
        default:
            break
        }
        if lhs.isPriority != rhs.isPriority {
            return lhs.isPriority
        }
        return newerRecordingPrecedes(lhs, rhs)
    }

    private static func laterPrecedes(_ lhs: TaskItem, _ rhs: TaskItem) -> Bool {
        newerRecordingPrecedes(lhs, rhs)
    }

    private static func newerRecordingPrecedes(_ lhs: TaskItem, _ rhs: TaskItem) -> Bool {
        let lhsTime = lhs.recordingCreatedDate?.timeIntervalSince1970 ?? 0
        let rhsTime = rhs.recordingCreatedDate?.timeIntervalSince1970 ?? 0
        if lhsTime != rhsTime {
            return lhsTime > rhsTime
        }
        if lhs.recordingID != rhs.recordingID {
            return lhs.recordingID > rhs.recordingID
        }
        if lhs.spokenIndex != rhs.spokenIndex {
            return lhs.spokenIndex < rhs.spokenIndex
        }
        return lhs.id < rhs.id
    }
}
