import SwiftUI

struct TaskListView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let bucket: TaskBucket
    let onError: (String) -> Void
    let onOpenNote: (String) -> Void

    init(
        bucket: TaskBucket,
        onError: @escaping (String) -> Void,
        onOpenNote: @escaping (String) -> Void
    ) {
        self.bucket = bucket
        self.onError = onError
        self.onOpenNote = onOpenNote
    }

    private var openItems: [TaskItem] {
        appState.taskList?.items(in: bucket) ?? []
    }

    private var doneItems: [TaskItem] {
        appState.taskList?.done.filter { $0.bucket == bucket } ?? []
    }

    private var hasCarriedItems: Bool {
        bucket == .today && openItems.contains { $0.carried }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            heading

            if openItems.isEmpty && doneItems.isEmpty {
                Text(emptyStateText)
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
            } else {
                rowList(openItems)

                if !doneItems.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Eyebrow(text: "done")
                        rowList(doneItems)
                    }
                    .opacity(0.85)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: appState.taskList)
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: bucket.title)
            Text(headingTitle)
                .font(.throughlineHeading)

            if hasCarriedItems {
                Text("Includes what you did not clear yesterday.")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var headingTitle: String {
        switch bucket {
        case .today:
            Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day())
        case .thisWeek:
            "Through Sunday"
        case .later:
            "No date yet"
        }
    }

    private var emptyStateText: String {
        switch bucket {
        case .today: "Nothing for today yet. Say what is on your mind."
        case .thisWeek: "Nothing dated for this week."
        case .later: "Nothing parked for later."
        }
    }

    private func rowList(_ items: [TaskItem]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(items) { task in
                TaskRow(
                    task: task,
                    bucket: bucket,
                    onToggle: { setCompleted(task, !task.isCompleted) },
                    onMove: { destination in move(task, to: destination) },
                    onOpenNote: { onOpenNote(task.recordingID) }
                )
                .transition(.opacity)

                if task.id != items.last?.id {
                    Rectangle()
                        .fill(Theme.border)
                        .frame(height: 0.5)
                }
            }
        }
    }

    // MARK: - Actions

    private func setCompleted(_ task: TaskItem, _ completed: Bool) {
        appState.markTask(task, completed: completed)

        if completed {
            ProductAnalytics.track(
                "task_completed",
                properties: ["bucket": bucket.rawValue, "carried": task.carried ? "true" : "false"]
            )
        } else {
            ProductAnalytics.track("task_reopened")
        }

        Task {
            do {
                let client = UploadClient()
                let recording = try await client.updateActionItem(
                    recordingID: task.recordingID,
                    text: task.text,
                    isCompleted: completed
                )
                appState.addUploadedNote(recording.displayNote())
                let list = try await client.fetchTasks(
                    date: TaskListResponse.localDate(),
                    timeZone: TaskListResponse.timeZoneIdentifier
                )
                appState.applyTaskList(list)
            } catch {
                onError(error.localizedDescription)
                await refetchTasks()
            }
        }
    }

    private func move(_ task: TaskItem, to destination: TaskBucket) {
        guard destination != bucket else { return }

        let timeframe: TaskTimeframe = switch destination {
        case .today: .today
        case .thisWeek: .thisWeek
        case .later: .later
        }

        Task {
            do {
                let response = try await UploadClient().moveTask(
                    recordingID: task.recordingID,
                    text: task.text,
                    timeframe: timeframe,
                    localDate: TaskListResponse.localDate(),
                    timeZone: TaskListResponse.timeZoneIdentifier
                )
                appState.addUploadedNote(response.recording.displayNote())
                appState.applyTaskList(response.tasks)
                ProductAnalytics.track(
                    "task_rebucketed",
                    properties: ["from": bucket.rawValue, "to": destination.rawValue]
                )
            } catch {
                onError(error.localizedDescription)
            }
        }
    }

    private func refetchTasks() async {
        do {
            let list = try await UploadClient().fetchTasks(
                date: TaskListResponse.localDate(),
                timeZone: TaskListResponse.timeZoneIdentifier
            )
            appState.applyTaskList(list)
        } catch {
            // The optimistic change stays on screen; the next refresh reconciles it.
        }
    }
}

private struct TaskRow: View {
    let task: TaskItem
    let bucket: TaskBucket
    let onToggle: () -> Void
    let onMove: (TaskBucket) -> Void
    let onOpenNote: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundColor(task.isCompleted ? Theme.blue : Color.secondary)
                    .frame(width: 22, height: 22)
            }
            .buttonStyle(.plain)
            .padding(.top, 1)
            .accessibilityLabel(task.isCompleted ? "Reopen" : "Done")

            VStack(alignment: .leading, spacing: 4) {
                Text(task.text)
                    .font(.system(size: 15, weight: task.isCompleted ? .regular : .medium))
                    .foregroundColor(task.isCompleted ? Color.secondary : Color.primary)
                    .strikethrough(task.isCompleted, color: .secondary)
                    .lineSpacing(3)

                metaLine
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())
        .contextMenu {
            ForEach(TaskBucket.allCases.filter { $0 != bucket }) { destination in
                Button {
                    onMove(destination)
                } label: {
                    Label(moveTitle(for: destination), systemImage: moveSymbol(for: destination))
                }
            }

            Button(action: onOpenNote) {
                Label("Open note", systemImage: "doc.text")
            }
        }
    }

    private var metaLine: some View {
        HStack(spacing: 8) {
            if task.carried && !task.isCompleted {
                Text(carriedLabel)
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Color.orange.opacity(0.15))
                    .foregroundColor(TaskRow.carriedText)
                    .clipShape(Capsule())
            }

            if task.isPriority && !task.isCompleted {
                Text("priority")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Theme.blue)
            }

            if bucket != .today {
                Text(dueLabel)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            Button(action: onOpenNote) {
                Text(sourceLabel)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open note")

            if task.isCompleted {
                Button(action: onToggle) {
                    Text("undo")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Theme.blue)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Undo")
            }
        }
        .font(.system(size: 12))
    }

    private static let carriedText = Color(red: 122 / 255, green: 75 / 255, blue: 0)

    private var carriedLabel: String {
        let today = TaskListResponse.localDate()
        guard let age = TaskListResponse.days(from: task.firstSeenLocalDate, to: today), age > 1,
              let firstSeen = TaskRow.date(fromLocalDate: task.firstSeenLocalDate)
        else {
            return "from yesterday"
        }

        return "from \(firstSeen.formatted(.dateTime.weekday(.abbreviated)))"
    }

    private var dueLabel: String {
        guard let due = task.due, let dueDate = TaskRow.date(fromLocalDate: due) else {
            return "no date"
        }

        let today = TaskListResponse.localDate()
        if due == today {
            return "today"
        }

        if let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: .now),
           due == TaskListResponse.localDate(tomorrow) {
            return "tomorrow"
        }

        return dueDate.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    private var sourceLabel: String {
        let title = task.recordingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let time = task.recordingCreatedDate?.formatted(.dateTime.hour().minute())

        if !title.isEmpty, let time {
            return "\(title) · \(time)"
        }

        if !title.isEmpty {
            return title
        }

        return time ?? "note"
    }

    private func moveTitle(for destination: TaskBucket) -> String {
        switch destination {
        case .today: "Move to today"
        case .thisWeek: "Move to this week"
        case .later: "Move to later"
        }
    }

    private func moveSymbol(for destination: TaskBucket) -> String {
        switch destination {
        case .today: "sun.max"
        case .thisWeek: "calendar"
        case .later: "tray"
        }
    }

    private static func date(fromLocalDate value: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }
}
