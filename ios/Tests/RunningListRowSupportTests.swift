// Appended to the exact production support declarations by the CLI runner.
// All dates, IDs and content are synthetic; no app state or network is used.
@MainActor private final class ActionOwner {
    let actions: RunningRowActions
    init(_ actions: RunningRowActions) { self.actions = actions }
    func bind() {
        actions.toggle = { _ in _ = self.actions }
        actions.move = { _, _ in _ = self.actions }
        actions.open = { _ in _ = self.actions }
    }
}
@main struct RunningListRowSupportTests {
    @MainActor static func main() {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
        let date = calendar.date(from: DateComponents(year: 2026, month: 10, day: 5, hour: 10, minute: 25))!
        let timestamp = TaskDates.iso(date)
        let task = TaskOccurrence(id: "synthetic-task", recordingID: "synthetic-note", version: 1, sourceOrder: 0,
            text: "Synthetic task", status: "open", createdAt: timestamp, originLocalDate: "2026-10-05",
            sourceCreatedAt: timestamp, sourceLocalDate: "2026-10-05", sourceTimezone: calendar.timeZone.identifier,
            sourceTitle: "Synthetic note", isEarlier: false)
        let row = RunningListRow(occurrence: task, placement: .today, marker: nil, isDateMarker: false, isPending: false)
        let actions = RunningRowActions()
        // An unchanged row holds this same reference, so replacing callbacks must affect its next tap.
        let cachedRowActions = actions
        var calls: [String] = []
        actions.toggle = { _ in calls.append("old") }
        actions.toggle = { _ in calls.append("toggle") }
        actions.move = { _, _ in calls.append("move") }
        actions.open = { _ in calls.append("open") }
        cachedRowActions.toggle(row); cachedRowActions.move(row, .later); cachedRowActions.open(row)
        precondition(calls == ["toggle", "move", "open"])
        print("PASS refreshed row actions")

        weak var retainedOwner: ActionOwner?
        do { let owner = ActionOwner(actions); retainedOwner = owner; owner.bind() }
        precondition(retainedOwner != nil, "fixture must reproduce the closure ownership cycle")
        actions.clear()
        precondition(retainedOwner == nil, "disappearance must release callbacks and their captured owner")
        calls.removeAll()
        actions.toggle(row); actions.move(row, .later); actions.open(row)
        precondition(calls.isEmpty)
        print("PASS captured action lifetime and clear")

        actions.toggle = { _ in calls.append("return-toggle") }
        actions.move = { _, _ in calls.append("return-move") }
        actions.open = { _ in calls.append("return-open") }
        cachedRowActions.toggle(row); cachedRowActions.move(row, .today); cachedRowActions.open(row)
        precondition(calls == ["return-toggle", "return-move", "return-open"])
        actions.clear()
        print("PASS actions after reappearance")

        let cache = RunningSourceTimes()
        let time = date.formatted(.dateTime.hour().minute())
        precondition(cache.label(row, now: date) == time)
        precondition(cache.label(row, now: date.addingTimeInterval(60)) == time)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: date)!
        precondition(cache.label(row, now: tomorrow) == "yesterday \(time)")
        let twoDays = calendar.date(byAdding: .day, value: 2, to: date)!
        precondition(cache.label(row, now: twoDays) == "\(date.formatted(.dateTime.weekday(.abbreviated))) \(time)")
        let older = calendar.date(byAdding: .day, value: 8, to: date)!
        precondition(cache.label(row, now: older) == date.formatted(.dateTime.month(.abbreviated).day()))
        precondition(cache.label(row, now: date) == time, "clock change back must invalidate labels")
        print("PASS timestamp cache across day boundaries and clock reversal")
    }
}
