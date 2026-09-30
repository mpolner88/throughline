import SwiftUI

extension RunningListTab {
    var title: String {
        switch self { case .today: "today"; case .thisWeek: "this week"; case .later: "later" }
    }
}

/// The Home content changes; Home itself and its capture lifecycle stay mounted.
struct RunningListView: View {
    @ObservedObject var coordinator: TaskCoordinator
    @Binding var selectedTab: RunningListTab
    let hiddenRecordingIDs: Set<String>
    let isFirstUse: Bool
    let emptyContent: AnyView
    let onOpenNote: (String) -> Void
    let onSignIn: () -> Void
    let onRefresh: () async -> Void
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var now = Date()
    @State private var earlierExpanded = false
    @State private var newIDs = Set<String>()
    @State private var knownIDs = Set<String>()
    @State private var pendingArrivals = Set<String>()
    @State private var hasBaseline = false
    @State private var additions: [RunningListTab: Int] = [:]
    @State private var additionToken = UUID()
    @State private var localError: String?

    private var snapshot: RunningListSnapshot { coordinator.snapshot(now: displayNow, timeZone: .current) }
    private var displayNow: Date {
        #if DEBUG
        if let date = RunningListPreview.currentDate { return date }
        #endif
        return now
    }
    private func visible(_ rows: [RunningListRow]) -> [RunningListRow] {
        rows.filter { !hiddenRecordingIDs.contains($0.recordingID) }
    }
    private var openRows: [RunningListRow] { visible(snapshot[selectedTab].open) }
    private var doneRows: [RunningListRow] { visible(snapshot[selectedTab].doneToday) }
    private var earlierRows: [RunningListRow] { visible(snapshot.earlier) }
    private var allVisibleRows: [RunningListRow] {
        RunningListTab.allCases.flatMap { visible(snapshot[$0].open) + visible(snapshot[$0].doneToday) } + earlierRows
    }

    var body: some View {
        VStack(spacing: 0) {
            tabs
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    if isFirstUse && selectedTab == .today && openRows.isEmpty {
                        emptyContent
                    } else {
                        if !openRows.isEmpty {
                            sectionHeading("open")
                            rows(openRows)
                        } else {
                            emptyTab
                        }
                        if !doneRows.isEmpty {
                            sectionHeading("done today", count: doneRows.count)
                            rows(doneRows)
                        }
                        if selectedTab == .later && !earlierRows.isEmpty {
                            earlierSection
                        }
                    }
                    if coordinator.signInRequired {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Sign in again to save your changes.").font(.footnote).foregroundStyle(.secondary)
                            Button("Sign in", action: onSignIn).font(.subheadline).frame(minHeight: 44)
                        }
                    } else if let message = localError ?? coordinator.errorMessage {
                        Text(message).font(.footnote).foregroundStyle(.secondary)
                            .accessibilityIdentifier("running-list-message")
                    } else if coordinator.isOffline {
                        Text("Offline. Changes save when you're connected.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24).padding(.top, 12).padding(.bottom, 24)
            }
            .refreshable { await onRefresh() }
        }
        .onAppear {
            newIDs.removeAll()
            knownIDs = coordinator.allOccurrenceIDs
            hasBaseline = coordinator.hasLoadedSnapshot
            #if DEBUG
            if RunningListPreview.isActive {
                selectedTab = RunningListPreview.selectedTab
                earlierExpanded = RunningListPreview.expandEarlier
                if RunningListPreview.showLanded {
                    newIDs = Set(allVisibleRows.filter { $0.recordingID == RunningListPreview.landedRecordingID }.map(\.id))
                    for tab in RunningListTab.allCases {
                        additions[tab] = visible(snapshot[tab].open).filter { newIDs.contains($0.id) }.count
                    }
                }
            }
            #endif
        }
        .onChange(of: allVisibleRows.map(\.id)) { _, _ in trackArrivals() }
        .onChange(of: coordinator.allOccurrenceIDs) { _, _ in trackArrivals() }
        .onChange(of: coordinator.hasLoadedSnapshot) { _, _ in trackArrivals() }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                now = Date()
                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = .current
                let nextDay = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now.addingTimeInterval(60)
                let delay = max(0.05, min(60, nextDay.timeIntervalSince(now)))
                do { try await Task.sleep(for: .seconds(delay)) } catch { break }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in now = Date() }
        .onReceive(NotificationCenter.default.publisher(for: .NSSystemTimeZoneDidChange)) { _ in now = Date() }
        .onChange(of: coordinator.signInRequired) { _, required in
            if required { newIDs.removeAll(); additions.removeAll(); hasBaseline = false; knownIDs.removeAll(); pendingArrivals.removeAll() }
        }
    }

    private var tabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 20) {
                ForEach(RunningListTab.allCases, id: \.self) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(tab.title).font(.subheadline.weight(selectedTab == tab ? .medium : .regular))
                            Text(String(visible(snapshot[tab].open).count)).font(.caption).monospacedDigit()
                            if let count = additions[tab], count > 0 {
                                Text("+\(count)").font(.caption.weight(.semibold)).foregroundStyle(Theme.blue)
                            }
                        }
                        .foregroundStyle(selectedTab == tab ? Color.primary : .secondary)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.vertical, 13)
                        .frame(minHeight: 44)
                        .overlay(alignment: .bottom) {
                            if selectedTab == tab { Rectangle().fill(Theme.blue).frame(height: 2) }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(tab.title), \(visible(snapshot[tab].open).count) tasks" + ((additions[tab] ?? 0) > 0 ? ", \(additions[tab]!) new" : ""))
                    .accessibilityAddTraits(selectedTab == tab ? [.isSelected] : [])
                    .accessibilityIdentifier("running-tab-\(tab.rawValue)")
                }
            }.padding(.horizontal, 24)
        }
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 0.5) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Eyebrow(text: selectedTab == .today ? "today" : selectedTab == .thisWeek ? "through sunday" : "after this week")
            Text(headerTitle).font(.subheadline.weight(.medium))
        }.accessibilityElement(children: .combine)
    }
    private var headerTitle: String {
        switch selectedTab {
        case .today: return displayNow.formatted(.dateTime.weekday(.wide).month(.wide).day())
        case .thisWeek:
            var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
            return calendar.component(.weekday, from: displayNow) == 1 ? "Sunday" : "\(displayNow.formatted(.dateTime.weekday(.abbreviated))) to Sun"
        case .later: return "Later"
        }
    }
    @ViewBuilder private var emptyTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(emptyTitle).font(.headline.weight(.medium))
            Text(emptyExplanation).font(.subheadline).foregroundStyle(.secondary).lineSpacing(3)
        }.padding(.top, 4)
    }
    private var emptyTitle: String {
        switch selectedTab {
        case .today: return "Nothing for today yet."
        case .thisWeek: return Calendar.current.component(.weekday, from: displayNow) == 1 ? "Nothing else this week." : "Nothing dated for this week."
        case .later: return "Nothing for later."
        }
    }
    private var emptyExplanation: String {
        switch selectedTab {
        case .today: return "Say what's on your mind. Tasks you mention land here, in this week, or later."
        case .thisWeek:
            return Calendar.current.component(.weekday, from: displayNow) == 1 ? "Tomorrow's tasks wait in later until Monday." : "Tasks you give a day this week, like \"by Friday\", land here."
        case .later: return "Tasks with a date after this week, or ones you move here, show up here."
        }
    }
    private func sectionHeading(_ title: String, count: Int? = nil) -> some View {
        HStack {
            Eyebrow(text: title)
            Spacer()
            if let count { Text(String(count)).font(.caption).foregroundStyle(.secondary) }
        }
    }
    private func rows(_ rows: [RunningListRow]) -> some View {
        LazyVStack(spacing: 0) {
            ForEach(rows) { row in
                RunningTaskRow(row: row, now: displayNow, isNew: newIDs.contains(row.id),
                    onToggle: { change(row, completed: !row.isCompleted) },
                    onMove: { move(row, to: $0) }, onOpen: { onOpenNote(row.recordingID) })
                if row.id != rows.last?.id { Divider() }
            }
        }
    }
    private var earlierSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeading("from earlier notes", count: earlierRows.count)
            if earlierExpanded { rows(earlierRows) }
            Button {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { earlierExpanded.toggle() }
            } label: {
                HStack(alignment: .firstTextBaseline) {
                    if !earlierExpanded {
                        Text("To-dos from notes before this update").foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 8)
                    Text(earlierExpanded ? "Hide" : "Show").foregroundStyle(Theme.blue)
                }.font(.subheadline).frame(minHeight: 44)
            }.buttonStyle(.plain).accessibilityLabel("\(earlierExpanded ? "Hide" : "Show") \(earlierRows.count) tasks from earlier notes")
        }
    }
    private func change(_ row: RunningListRow, completed: Bool) {
        do {
            try withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                try coordinator.setCompleted(id: row.id, completed: completed, from: row.placement)
            }
            localError = nil
            if UIAccessibility.isVoiceOverRunning {
                UIAccessibility.post(notification: .announcement, argument: completed ? "Done. Undo available." : "Reopened.")
            }
        } catch { localError = error.localizedDescription }
    }
    private func move(_ row: RunningListRow, to tab: RunningListTab) {
        do {
            try withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                try coordinator.move(id: row.id, to: tab, now: displayNow, timeZone: .current)
            }
            localError = nil
        } catch { localError = error.localizedDescription }
    }
    private func trackArrivals() {
        let current = Set(allVisibleRows.map(\.id))
        guard hasBaseline else {
            knownIDs.formUnion(coordinator.allOccurrenceIDs)
            hasBaseline = coordinator.hasLoadedSnapshot
            return
        }
        let all = coordinator.allOccurrenceIDs
        pendingArrivals.formUnion(all.subtracting(knownIDs))
        knownIDs.formUnion(all)
        let arrived = current.intersection(pendingArrivals)
        pendingArrivals.subtract(arrived)
        guard !arrived.isEmpty else { return }
        newIDs.formUnion(arrived)
        let token = UUID(); additionToken = token
        for tab in RunningListTab.allCases { additions[tab] = visible(snapshot[tab].open).filter { arrived.contains($0.id) }.count }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            guard additionToken == token else { return }
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { additions.removeAll() }
        }
    }
}

private struct RunningTaskRow: View {
    let row: RunningListRow
    let now: Date
    let isNew: Bool
    let onToggle: () -> Void
    let onMove: (RunningListTab) -> Void
    let onOpen: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var horizontalOffset: CGFloat = 0
    @State private var showingMenu = false
    @ScaledMetric(relativeTo: .body) private var taskFontSize: CGFloat = 16
    private let completeThreshold: CGFloat = 76

    var body: some View {
        ZStack(alignment: .leading) {
            HStack(spacing: 8) {
                Image(systemName: row.isCompleted ? "arrow.uturn.left" : "checkmark")
                Text(row.isCompleted ? "Reopen" : "Done")
                Spacer()
            }
            .font(.subheadline.weight(.medium)).foregroundStyle(.white)
            .padding(.horizontal, 14).frame(maxWidth: .infinity, minHeight: 58)
            .background(row.isCompleted ? Color.secondary : Theme.blue)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius))
            .opacity(horizontalOffset > 0.5 ? 1 : 0)

            HStack(alignment: .top, spacing: 1) {
                Button(action: onToggle) {
                    Image(systemName: row.isCompleted ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22)).foregroundStyle(row.isCompleted ? Theme.blue : .secondary)
                        .frame(width: 44, height: 44)
                }.buttonStyle(.plain).padding(.leading, -11).padding(.top, -9)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        if isNew { Circle().fill(Theme.blue).frame(width: 6, height: 6).accessibilityHidden(true) }
                        Text(row.text).font(.system(size: taskFontSize)).lineSpacing(2).fixedSize(horizontal: false, vertical: true)
                            .foregroundStyle(row.isCompleted ? Color.secondary : .primary)
                            .strikethrough(row.isCompleted, color: .secondary)
                    }
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) { marker; source }
                        VStack(alignment: .leading, spacing: 5) { marker; source }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if row.isCompleted {
                    Button("Undo", action: onToggle).font(.subheadline.weight(.medium)).foregroundStyle(Theme.blue)
                        .frame(minWidth: 44, minHeight: 44).buttonStyle(.plain)
                } else {
                    Button { showingMenu = true } label: {
                        Image(systemName: "ellipsis").font(.title3).foregroundStyle(.secondary).frame(width: 44, height: 44)
                    }.buttonStyle(.plain).padding(.trailing, -12)
                }
            }
            .padding(.vertical, 11).background(.background)
            .contentShape(Rectangle())
            .offset(x: max(0, horizontalOffset))
            .gesture(DragGesture(minimumDistance: 18)
                .onChanged { value in
                    guard abs(value.translation.width) > abs(value.translation.height) else { return }
                    horizontalOffset = max(0, min(value.translation.width, completeThreshold + 18))
                }
                .onEnded { value in
                    let shouldToggle = value.translation.width >= completeThreshold && abs(value.translation.width) > abs(value.translation.height)
                    withAnimation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 0.82)) { horizontalOffset = 0 }
                    if shouldToggle { onToggle() }
                })
            .simultaneousGesture(LongPressGesture().onEnded { _ in showingMenu = true })
        }
        .onAppear {
            #if DEBUG
            if RunningListPreview.scenario == "menu" && row.id == RunningListPreview.firstTaskID { showingMenu = true }
            if RunningListPreview.scenario == "swipe" && row.id == "00000000-0000-4000-8000-000000000004" { horizontalOffset = 80 }
            #endif
        }
        .confirmationDialog(row.text, isPresented: $showingMenu, titleVisibility: .visible) {
            ForEach(RunningListTab.allCases.filter { row.placement == .earlier || $0 != row.placement.tab }, id: \.self) { tab in
                Button("Move to \(tab.title)") { onMove(tab) }
            }
            Button("Open the note", action: onOpen)
            Button("Cancel", role: .cancel) {}
        } message: { Text("From your \(row.noteTitle) note, \(sourceTime).") }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(row.text). \(row.marker.map { $0 + ". " } ?? "")From \(row.noteTitle), \(sourceTime).")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(named: row.isCompleted ? "Reopen" : "Complete", onToggle)
        .accessibilityAction(.default, onToggle)
        .accessibilityActions {
            ForEach(RunningListTab.allCases.filter { row.placement == .earlier || $0 != row.placement.tab }, id: \.self) { tab in
                Button("Move to \(tab.title)") { onMove(tab) }
            }
            Button("Open the note", action: onOpen)
        }
        .accessibilityIdentifier("running-task-\(row.id)")
    }
    @ViewBuilder private var marker: some View {
        if let marker = row.marker {
            Text(marker).font(.caption.weight(.medium))
                .foregroundStyle(row.isDateMarker ? (colorScheme == .dark ? Theme.liftedBlue : Theme.pillText) : Color.secondary)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(row.isDateMarker ? Theme.blue.opacity(colorScheme == .dark ? 0.16 : 0.07) : Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
    private var source: some View {
        Button(action: onOpen) {
            Text("\(row.noteTitle) · \(sourceTime)")
                .font(.caption).foregroundStyle(.secondary).underline(color: Theme.border)
                .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
        }.buttonStyle(.plain)
    }
    private var sourceTime: String {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
        let date = row.sourceCreatedAt
        let day = calendar.startOfDay(for: now)
        let time = date.formatted(.dateTime.hour().minute())
        if calendar.isDate(date, inSameDayAs: now) { return time }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: day), calendar.isDate(date, inSameDayAs: yesterday) { return "yesterday \(time)" }
        if let weekAgo = calendar.date(byAdding: .day, value: -7, to: day), date >= weekAgo, date < day {
            return "\(date.formatted(.dateTime.weekday(.abbreviated))) \(time)"
        }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}
