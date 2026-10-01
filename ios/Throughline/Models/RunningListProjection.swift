import Foundation

enum TaskDates {
    static func instant(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
    static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
    static func calendar(_ zone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar
    }
    static func civil(_ date: Date, zone: TimeZone) -> String {
        let c = calendar(zone).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
    /// Validate a date without applying the viewer's offset or accepting normalized invalid dates.
    static func dateOnly(_ value: String?) -> String? {
        guard let value, value.utf8.count == 10 else { return nil }
        let parts = value.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              value.allSatisfy({ $0.isASCII && ($0.isNumber || $0 == "-") }),
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]), year > 0 else { return nil }
        let utc = TimeZone(secondsFromGMT: 0)!
        guard let date = calendar(utc).date(from: DateComponents(year: year, month: month, day: day, hour: 12)),
              civil(date, zone: utc) == value else { return nil }
        return value
    }
    static func nextMidnight(after now: Date, zone: TimeZone) -> Date {
        let calendar = calendar(zone)
        return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
    }
    /// This week excludes today; Saturday has only Sunday left in its range.
    static func thisWeekHeader(now: Date, zone: TimeZone, locale: Locale = .current) -> String {
        let calendar = calendar(zone)
        switch calendar.component(.weekday, from: now) {
        case 1: return "Sunday"
        case 7: return "Sun"
        default:
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: now)!
            let formatter = DateFormatter()
            formatter.calendar = calendar
            formatter.timeZone = zone
            formatter.locale = locale
            formatter.setLocalizedDateFormatFromTemplate("EEE")
            return "\(formatter.string(from: tomorrow)) to Sun"
        }
    }
    static func sunday(now: Date, zone: TimeZone) -> String {
        let calendar = calendar(zone)
        let days = (8 - calendar.component(.weekday, from: now)) % 7
        return civil(calendar.date(byAdding: .day, value: days, to: now)!, zone: zone)
    }
    static func weekday(_ day: String) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar(TimeZone(secondsFromGMT: 0)!)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)!
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: day) else { return day }
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("EEE")
        return formatter.string(from: date)
    }
    static func shortLabel(_ day: String, today: String, yesterday: String) -> String {
        if day == yesterday { return "yesterday" }
        let utc = TimeZone(secondsFromGMT: 0)!
        let formatter = DateFormatter()
        formatter.calendar = calendar(utc)
        formatter.locale = .current
        formatter.timeZone = utc
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: day), let todayDate = formatter.date(from: today) else { return day }
        let distance = calendar(utc).dateComponents([.day], from: date, to: todayDate).day ?? 0
        formatter.setLocalizedDateFormatFromTemplate(distance >= 0 && distance < 7 ? "EEE" : "MMM d")
        return formatter.string(from: date)
    }
}

struct RunningListRow: Identifiable, Equatable {
    var occurrence: TaskOccurrence
    var placement: TaskPresentationPlacement
    var marker: String?
    var isDateMarker: Bool
    var isPending: Bool
    var id: String { occurrence.id }
    var text: String { occurrence.text }
    var recordingID: String { occurrence.recordingID }
    var noteTitle: String { occurrence.sourceTitle }
    var sourceCreatedAt: Date { occurrence.sourceDate }
    var isCompleted: Bool { occurrence.isCompleted }
}
struct RunningListTabSnapshot: Equatable {
    var open: [RunningListRow] = []
    var doneToday: [RunningListRow] = []
    var openCount: Int { open.count }
}
struct RunningListSnapshot: Equatable {
    var today = RunningListTabSnapshot()
    var thisWeek = RunningListTabSnapshot()
    var later = RunningListTabSnapshot()
    var earlier: [RunningListRow] = []
    subscript(_ tab: RunningListTab) -> RunningListTabSnapshot {
        get { switch tab { case .today: today; case .thisWeek: thisWeek; case .later: later } }
        set { switch tab { case .today: today = newValue; case .thisWeek: thisWeek = newValue; case .later: later = newValue } }
    }
}

enum RunningListProjection {
    static func overlay(_ occurrences: [TaskOccurrence], commands: [TaskPendingCommand]) -> [TaskOccurrence] {
        var values = Dictionary(uniqueKeysWithValues: occurrences.map { ($0.id, $0) })
        for command in commands {
            guard var item = values[command.occurrenceID], item.recordingID == command.recordingID else { continue }
            switch command.request.operation {
            case .setCompletion:
                item.status = command.request.completed == true ? "completed" : "open"
                item.completedAt = command.request.completed == true ? command.request.occurredAt : nil
                item.completedPlacement = command.request.completed == true ? command.request.completionPlacement : nil
            case .setPlacement:
                item.placementOverride = command.request.placement
                item.placementAnchorDate = command.request.anchorDate
                item.isEarlier = false
            }
            values[item.id] = item
        }
        return Array(values.values)
    }
    static func placement(_ task: TaskOccurrence, now: Date, timeZone: TimeZone) -> TaskPresentationPlacement {
        if let override = task.placementOverride { return TaskPresentationPlacement(rawValue: override.rawValue)! }
        // Mike's device feedback supersedes the collapsed earlier-notes section.
        // Keep provenance in storage; an explicit move above still wins.
        if task.isEarlier { return .today }
        guard let day = TaskDates.dateOnly(task.due) ?? TaskDates.dateOnly(task.forDate) else { return .today }
        if day <= TaskDates.civil(now, zone: timeZone) { return .today }
        return day <= TaskDates.sunday(now: now, zone: timeZone) ? .thisWeek : .later
    }
    static func project(occurrences: [TaskOccurrence], commands: [TaskPendingCommand] = [],
                        now: Date, timeZone: TimeZone) -> RunningListSnapshot {
        var result = RunningListSnapshot()
        // One parser and one set of sort keys per projection, not per comparison.
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let whole = ISO8601DateFormatter()
        whole.formatOptions = [.withInternetDateTime]
        var instants: [String: Date] = [:]
        func instant(_ value: String) -> Date {
            if let cached = instants[value] { return cached }
            let date = fractional.date(from: value) ?? whole.date(from: value) ?? .distantPast
            instants[value] = date
            return date
        }
        var sortKeys: [String: SortKey] = [:]
        var completionDates: [String: Date] = [:]
        let calendar = TaskDates.calendar(timeZone)
        let today = TaskDates.civil(now, zone: timeZone)
        let yesterday = TaskDates.civil(calendar.date(byAdding: .day, value: -1, to: now)!, zone: timeZone)
        let tomorrow = TaskDates.civil(calendar.date(byAdding: .day, value: 1, to: now)!, zone: timeZone)
        let pending = Set(commands.map(\.occurrenceID))
        for item in overlay(occurrences, commands: commands) {
            if item.isCompleted {
                guard let timestamp = item.completedAt,
                      calendar.isDate(instant(timestamp), inSameDayAs: now) else { continue }
                completionDates[item.id] = instant(timestamp)
            }
            let moved = item.placementOverride != nil
            sortKeys[item.id] = SortKey(moved: moved,
                day: (moved ? item.placementAnchorDate : TaskDates.dateOnly(item.due) ?? TaskDates.dateOnly(item.forDate) ?? item.originLocalDate) ?? "",
                source: instant(item.sourceCreatedAt), order: item.sourceOrder, id: item.id)
            let home = placement(item, now: now, timeZone: timeZone)
            var marker: String?
            var dated = false
            if item.placementOverride != nil {
                if let anchor = TaskDates.dateOnly(item.placementAnchorDate), anchor < today {
                    marker = "moved " + TaskDates.shortLabel(anchor, today: today, yesterday: yesterday)
                }
            } else if home != .earlier {
                let explicit = TaskDates.dateOnly(item.due) ?? TaskDates.dateOnly(item.forDate)
                let day = explicit ?? TaskDates.dateOnly(item.originLocalDate)
                if let day {
                    if day < today { marker = "from " + TaskDates.shortLabel(day, today: today, yesterday: yesterday) }
                    else if explicit != nil {
                        dated = true
                        marker = day == today ? "today" : day == tomorrow ? "tomorrow" : home == .thisWeek ? TaskDates.weekday(day) : TaskDates.shortLabel(day, today: today, yesterday: yesterday)
                    }
                }
            }
            var row = RunningListRow(occurrence: item, placement: home, marker: marker, isDateMarker: dated, isPending: pending.contains(item.id))
            if item.isCompleted {
                let tab = item.completedPlacement ?? home.tab
                row.placement = TaskPresentationPlacement(rawValue: tab.rawValue)!
                row.marker = nil
                row.isDateMarker = false
                result[tab].doneToday.append(row)
            } else if home == .earlier { result.earlier.append(row) }
            else { result[home.tab].open.append(row) }
        }
        for tab in RunningListTab.allCases {
            result[tab].open.sort { ordered(sortKeys[$0.id]!, sortKeys[$1.id]!, tab: tab) }
            result[tab].doneToday.sort {
                let a = completionDates[$0.id] ?? .distantPast
                let b = completionDates[$1.id] ?? .distantPast
                return a == b ? $0.id < $1.id : a < b
            }
        }
        return result
    }
    private struct SortKey {
        let moved: Bool
        let day: String
        let source: Date
        let order: Int
        let id: String
    }
    private static func ordered(_ a: SortKey, _ b: SortKey, tab: RunningListTab) -> Bool {
        if tab != .today && a.moved != b.moved { return !a.moved }
        if a.day != b.day {
            if tab == .later && a.moved && b.moved { return a.day > b.day }
            return a.day < b.day
        }
        if a.source != b.source { return a.source < b.source }
        if a.order != b.order { return a.order < b.order }
        return a.id < b.id
    }
}
