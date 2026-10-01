#if DEBUG
import Foundation

/// Synthetic-only simulator scenarios, using the same projection and controls as the app.
enum RunningListPreview {
    static var scenario: String {
        ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--throughline-preview-running=") })?
            .split(separator: "=", maxSplits: 1).last.map(String.init) ?? ""
    }
    static var isActive: Bool { !scenario.isEmpty }
    static var currentDate: Date? {
        guard isActive else { return nil }
        let day = scenario == "morning" ? "2026-09-30" : ["sunday", "sunday-week"].contains(scenario) ? "2026-10-04" : scenario == "moved" ? "2026-10-05" : scenario == "saturday-week" ? "2026-10-03" : "2026-09-29"
        return TaskDates.instant(day + "T13:00:00-07:00")!
    }
    static var selectedTab: RunningListTab {
        if ["week", "sunday-week", "saturday-week", "moved"].contains(scenario) { return .thisWeek }
        if ["later", "earlier", "sunday", "empty-later"].contains(scenario) { return .later }
        return .today
    }
    static var expandEarlier: Bool { scenario == "earlier" }
    static var showLanded: Bool { ["landed", "repeat"].contains(scenario) }
    static let landedRecordingID = "rec_synthetic_running_lunch"
    static let detailRecordingID = "rec_synthetic_running_walk"
    static let firstTaskID = "00000000-0000-4000-8000-000000000001"
    static var showNotes: Bool { ["notes", "discard"].contains(scenario) }
    static var showDetail: Bool { ["source", "editor", "editor-conflict", "editor-pending"].contains(scenario) }

    private struct Source {
        var id: String; var title: String; var date: String; var summary: String
    }
    private static var sources: [Source] {
        var list = [
            Source(id: "rec_synthetic_running_drive", title: "drive home", date: "2026-09-28T18:10:00-07:00", summary: "Wrap up the tester thread, plan the trip, think about a gift."),
            Source(id: detailRecordingID, title: "morning walk", date: "2026-09-29T07:42:00-07:00", summary: "The deck goes to Sam today, the bank about the card, the dentist this week."),
            Source(id: "rec_synthetic_running_in", title: "drive in", date: "2026-09-29T08:15:00-07:00", summary: "Package, coffee filters, and the Sunday review outline."),
            Source(id: "rec_synthetic_running_sat", title: "Sat walk", date: "2026-09-26T10:05:00-07:00", summary: "Garage shelves and the pottery course, whenever."),
            Source(id: "rec_synthetic_running_earlier", title: "errands", date: "2026-08-21T17:30:00-07:00", summary: "From before the running list: the lease message and the library books.")
        ]
        if scenario == "landed" { list.append(Source(id: landedRecordingID, title: "lunch walk", date: "2026-09-29T12:20:00-07:00", summary: "Call Marcus back, the invoice by Friday, running shoes someday.")) }
        if scenario == "repeat" { list.append(Source(id: landedRecordingID, title: "drive home", date: "2026-09-29T12:20:00-07:00", summary: "The bank again, and groceries.")) }
        return list
    }
    static var tasks: [TaskOccurrence] {
        let texts = ["Reply to the tester about the build", "Send Sam the revised deck", "Call the bank about the new card", "Pick up the package on the way home", "Buy coffee filters", "Renew the car registration", "Book the dentist", "Draft the Sunday review outline", "Plan the October trip", "Clear out the garage shelves", "Look into the pottery course", "Think about a gift for Dana", "Email the landlord about the lease", "Return the library books"]
        let sourceIndex = [0,1,1,2,2,1,1,2,0,3,3,0,4,4]
        let dates: [Int: String] = [1:"2026-09-29",5:"2026-09-30",6:"2026-10-01",7:"2026-10-04",8:"2026-10-05"]
        var order: [String:Int] = [:]
        var result = texts.enumerated().map { index, text -> TaskOccurrence in
            let source = sources[sourceIndex[index]]
            let sourceOrder = order[source.id, default: 0]; order[source.id] = sourceOrder + 1
            var task = TaskOccurrence(id: String(format:"00000000-0000-4000-8000-%012d",index+1), recordingID: source.id, version: 1, sourceOrder: sourceOrder, text: text, status: "open", completedAt: nil, due: dates[index], forDate: nil, createdAt: source.date, originLocalDate: String(source.date.prefix(10)), sourceCreatedAt: source.date, sourceLocalDate: String(source.date.prefix(10)), sourceTimezone: "America/Los_Angeles", sourceTitle: source.title, isEarlier: index >= 12, placementOverride: nil, placementAnchorDate: nil, completedPlacement: nil)
            if [9,10,11].contains(index) { task.placementOverride = .later; task.placementAnchorDate = index == 11 ? "2026-09-28" : "2026-09-26" }
            if (["done", "editor", "editor-conflict", "editor-pending"].contains(scenario) && [2,4].contains(index)) || (["morning", "repeat"].contains(scenario) && index == 2) {
                task.status = "completed"; task.completedAt = "2026-09-29T12:00:00-07:00"; task.completedPlacement = .today
            }
            if scenario == "moved" && index == 4 { task.placementOverride = .thisWeek; task.placementAnchorDate = "2026-09-29" }
            return task
        }
        if scenario == "empty" { result.removeAll { RunningListProjection.placement($0, now: currentDate!, timeZone: TimeZone(identifier:"America/Los_Angeles")!) == .today } }
        if scenario == "empty-later" { result.removeAll { [.later,.earlier].contains(RunningListProjection.placement($0, now: currentDate!, timeZone: TimeZone(identifier:"America/Los_Angeles")!)) } }
        if showLanded, let source = sources.last {
            let additions = scenario == "repeat" ? ["Call the bank about the new card", "Pick up groceries for Thursday"] : ["Call Marcus back", "Send the invoice", "Look at new running shoes"]
            for (i,text) in additions.enumerated() {
                let due: String? = i == 1 ? (scenario == "repeat" ? "2026-10-01" : "2026-10-02") : i == 0 && scenario == "landed" ? "2026-09-29" : nil
                result.append(TaskOccurrence(id: String(format:"00000000-0000-4000-8000-%012d",i+101), recordingID: source.id, version: 1, sourceOrder: i, text: text, status: "open", completedAt: nil, due: due, forDate: nil, createdAt: source.date, originLocalDate: "2026-09-29", sourceCreatedAt: source.date, sourceLocalDate: "2026-09-29", sourceTimezone: "America/Los_Angeles", sourceTitle: source.title, isEarlier: false, placementOverride: nil, placementAnchorDate: nil, completedPlacement: nil))
            }
        }
        return result
    }
    static var notes: [ThroughlineNote] {
        sources.map { source in
            let occurrences = tasks.filter { $0.recordingID == source.id }.sorted { $0.sourceOrder < $1.sourceOrder }
            return ThroughlineNote(id: source.id, createdAt: TaskDates.instant(source.date)!, type: source.id == detailRecordingID ? .morning : .freeform, processingStatus: "processed", title: source.title, summary: source.summary, transcript: "Synthetic transcript for implementation review. No private recording is used.", mostImportant: [source.summary], todos: occurrences.map { Todo(id: $0.id, text: $0.text, status: $0.status, priority: nil, due: $0.due, forDate: $0.forDate, context: nil, completedAt: $0.completedAt) }, priorities: [], intentions: [], accomplishments: [], tomorrowTodos: [], mood: nil, tags: [], people: [], projects: [], centersOfBalance: [])
        }.sorted { $0.createdAt > $1.createdAt }
    }
}
#endif
