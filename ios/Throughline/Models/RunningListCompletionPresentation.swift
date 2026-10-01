import Foundation

/// Presentation only: completion and Undo are already durably queued by TaskCoordinator.
/// Each pause has its own token and original neighbours, so old timers and rapid Undo
/// cannot shorten a later pause or reorder another row (including across tabs).
struct RunningListCompletionPresentation {
    private struct Pause {
        let token: UUID
        let tab: RunningListTab
        let order: [String]
        let index: Int
    }
    private var pauses: [String: Pause] = [:]

    mutating func begin(id: String, tab: RunningListTab, order: [String]) -> UUID {
        let token = UUID()
        if let index = order.firstIndex(of: id) {
            pauses[id] = Pause(token: token, tab: tab, order: order, index: index)
        }
        return token
    }
    mutating func cancel(_ id: String) { pauses.removeValue(forKey: id) }
    mutating func clear() { pauses.removeAll() }
    mutating func retain(ids: Set<String>) { pauses = pauses.filter { ids.contains($0.key) } }
    mutating func finish(id: String, token: UUID) {
        guard pauses[id]?.token == token else { return }
        pauses.removeValue(forKey: id)
    }

    func present(open: [RunningListRow], done: [RunningListRow], tab: RunningListTab) -> RunningListTabSnapshot {
        guard !pauses.isEmpty else { return RunningListTabSnapshot(open: open, doneToday: done) }
        var rows = open
        var held = Set<String>()
        let candidates = pauses.filter { $0.value.tab == tab }.sorted {
            $0.value.index == $1.value.index ? $0.key < $1.key : $0.value.index < $1.value.index
        }
        for (id, pause) in candidates {
            guard !rows.contains(where: { $0.id == id }), let row = done.first(where: { $0.id == id }) else { continue }
            let following = pause.order.dropFirst(pause.index + 1)
            let preceding = pause.order.prefix(pause.index).reversed()
            let nextIndex = following.lazy.compactMap { next in rows.firstIndex { $0.id == next } }.first
            let previousIndex = preceding.lazy.compactMap { previous in rows.firstIndex { $0.id == previous } }.first
            let index = nextIndex ?? previousIndex.map { $0 + 1 } ?? min(pause.index, rows.count)
            rows.insert(row, at: index)
            held.insert(id)
        }
        return RunningListTabSnapshot(open: rows, doneToday: done.filter { !held.contains($0.id) })
    }
}
