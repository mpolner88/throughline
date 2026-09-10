import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

private enum RecorderPhase: Equatable {
    case idle
    case preparing
    case recording
    case finishing
    case saving
    case saved
    case sorting
    case landed(added: Int)
    case failed(String)

    // Phases where the record button must not accept another tap.
    var isBusy: Bool {
        switch self {
        case .preparing, .finishing, .saving, .saved, .sorting: true
        case .idle, .recording, .landed, .failed: false
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(AIProcessingPermission.storageKey) private var hasAIProcessingPermission = false
    @StateObject private var recorder = AudioRecorder()
    @State private var uploadError: String?
    @State private var showingSettings = false
    @State private var showingNotes = false
    @State private var showingAIProcessingConsent = false
    @State private var isRefreshing = false
    @State private var phase: RecorderPhase = .idle
    @State private var holdBarProgress: CGFloat = 1
    @State private var tabDeltas: [TaskBucket: Int] = [:]
    @State private var tabDeltaGeneration = 0
    @State private var notesInitialNoteID: String?
    private let maxRecordingSeconds = 300
    private let savedHoldSeconds = 2.6
    private let landedHoldSeconds = 1.8
    private let tabDeltaSeconds = 3.2

    var body: some View {
        VStack(spacing: 0) {
            topBar

            TaskTabStrip(
                selected: appState.selectedBucket,
                counts: appState.taskList?.counts,
                deltas: tabDeltas
            ) { bucket in
                guard bucket != appState.selectedBucket else { return }
                appState.selectedBucket = bucket
                ProductAnalytics.track("tab_selected", properties: ["tab": bucket.rawValue])
            }

            ScrollView {
                TaskListView(
                    bucket: appState.selectedBucket,
                    onError: { message in
                        uploadError = message
                    },
                    onOpenNote: { noteID in
                        openNotes(initialNoteID: noteID)
                    }
                )
                .padding(24)
            }
            .refreshable {
                await refreshFromBackend()
            }

            bottomRecorder
        }
        .task {
            ProductAnalytics.track("home_viewed")
            await refreshFromBackend()
        }
        .onChange(of: recorder.elapsedSeconds) { _, elapsedSeconds in
            if recorder.isRecording && elapsedSeconds >= maxRecordingSeconds {
                stopAndUploadRecording()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            rederiveCachedListIfStale()
            Task {
                _ = await refreshTasks()
            }
        }
        .sheet(isPresented: $showingSettings) {
            AccountSettingsView()
        }
        .sheet(isPresented: $showingNotes, onDismiss: { notesInitialNoteID = nil }) {
            NotesView(initialNoteID: notesInitialNoteID)
        }
        .sheet(isPresented: $showingAIProcessingConsent) {
            AIProcessingConsentView(isCurrentlyAllowed: hasAIProcessingPermission) { allowed in
                hasAIProcessingPermission = allowed
                if allowed {
                    Task {
                        try? await Task.sleep(for: .milliseconds(250))
                        startRecording()
                    }
                }
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: 18) {
            Wordmark()
            Spacer()

            Button {
                openNotes(initialNoteID: nil)
            } label: {
                HStack(spacing: 4) {
                    Text("notes")
                        .font(.system(size: 15, weight: .medium))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Theme.blue)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Notes")

            Button {
                ProductAnalytics.track("settings_opened")
                showingSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 17, weight: .regular))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 14)
    }

    private var bottomRecorder: some View {
        VStack(spacing: 9) {
            Divider()

            if let uploadError {
                Text(uploadError)
                    .font(.system(size: 13))
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            RecordButton(
                isRecording: recorder.isRecording,
                isBusy: phase.isBusy,
                size: 56
            ) {
                handleRecordTap()
            }
            .disabled(phase.isBusy)

            statusLine
        }
        .padding(.top, 12)
        .padding(.bottom, 22)
        .background(.background)
    }

    @ViewBuilder
    private var statusLine: some View {
        switch phase {
        case .saved:
            VStack(spacing: 5) {
                HStack(spacing: 7) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.blue)
                    Text("saved")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.primary)
                }

                // The drain starts from the bar's own appearance so SwiftUI
                // has a rendered full-width bar to animate from.
                Rectangle()
                    .fill(Theme.blue)
                    .frame(height: 2)
                    .scaleEffect(x: holdBarProgress, y: 1, anchor: .leading)
                    .accessibilityHidden(true)
                    .onAppear {
                        guard !reduceMotion else { return }
                        withAnimation(.linear(duration: savedHoldSeconds)) {
                            holdBarProgress = 0
                        }
                    }
            }
            .fixedSize(horizontal: true, vertical: false)
        case let .failed(message):
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        default:
            Text(recorderStatusText)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
    }

    private var recorderStatusText: String {
        switch phase {
        case .idle:
            "tap to record"
        case .preparing:
            "requesting microphone access"
        case .recording:
            "\(recorder.elapsedText) / 5:00"
        case .finishing:
            "finishing"
        case .saving:
            "saving"
        case .saved:
            "saved"
        case .sorting:
            "sorting into today, this week, later"
        case let .landed(added):
            added > 0 ? "\(added) added" : "nothing new"
        case let .failed(message):
            message
        }
    }

    // MARK: - Navigation

    private func openNotes(initialNoteID: String?) {
        notesInitialNoteID = initialNoteID
        ProductAnalytics.track("notes_view_opened")
        showingNotes = true
    }

    // MARK: - Recording

    private func handleRecordTap() {
        guard !phase.isBusy else { return }

        if recorder.isRecording {
            stopAndUploadRecording()
        } else {
            guard hasAIProcessingPermission else {
                showingAIProcessingConsent = true
                return
            }

            startRecording()
        }
    }

    private func startRecording() {
        guard phase != .preparing, !recorder.isRecording else { return }

        Task {
            phase = .preparing
            await recorder.requestPermissionIfNeeded()
            do {
                try recorder.start(limitSeconds: nil)
                phase = .recording
                ProductAnalytics.track("recording_started", properties: ["surface": "home"])
                uploadError = nil
            } catch {
                phase = .idle
                uploadError = error.localizedDescription
            }
        }
    }

    private func stopAndUploadRecording() {
        guard recorder.isRecording, !phase.isBusy else { return }

        Task {
            do {
                phase = .finishing
                let duration = min(recorder.elapsedSeconds, maxRecordingSeconds)
                let fileURL = try await recorder.stop()

                guard hasAIProcessingPermission else {
                    try? FileManager.default.removeItem(at: fileURL)
                    phase = .idle
                    uploadError = "Allow AI processing before sending a recording to Supabase and Groq."
                    return
                }

                phase = .saving
                // Rendered while the upload is in flight, so the saved bar
                // is inserted at full width before its drain starts.
                holdBarProgress = 1
                let countsBeforeUpload = appState.taskList?.counts ?? TaskCounts()

                let response = try await UploadClient().uploadRecording(
                    fileURL: fileURL,
                    duration: duration,
                    type: .freeform,
                    processingMode: .async
                )

                ProductAnalytics.track(
                    "recording_uploaded",
                    properties: ["duration_bucket": recordingDurationBucket(duration)]
                )
                appState.addUploadedNote(response.displayNote)
                uploadError = nil

                await showSavedConfirmation()

                phase = .sorting
                await refreshRecordingUntilSettled(id: response.id)
                await refreshNotes()
                let didFetchTasks = await refreshTasks()

                let settledNote = appState.notes.first { $0.id == response.id }
                let finalStatus = settledNote?.processingStatus ?? "unknown"
                if finalStatus == "processed" {
                    ProductAnalytics.track(
                        "recording_processed",
                        properties: ["processing_status": finalStatus]
                    )
                } else if Self.failedProcessingStatuses.contains(finalStatus) {
                    ProductAnalytics.track(
                        "recording_failed",
                        properties: ["processing_status": finalStatus, "stage": "processing"]
                    )
                    phase = .failed(settledNote?.processingText ?? "Processing failed")
                    return
                }

                guard didFetchTasks else {
                    phase = .idle
                    return
                }

                let countsAfterUpload = appState.taskList?.counts ?? TaskCounts()
                let added = showTabDeltas(from: countsBeforeUpload, to: countsAfterUpload)
                phase = .landed(added: added)
                try? await Task.sleep(for: .seconds(landedHoldSeconds))
                if case .landed = phase {
                    phase = .idle
                }
            } catch {
                ProductAnalytics.track(
                    "recording_failed",
                    properties: ["surface": "home", "stage": "upload_or_processing"]
                )
                phase = .failed(error.localizedDescription)
                await refreshFromBackend()
            }
        }
    }

    // Holds "saved" on screen long enough to read while the bar drains.
    private func showSavedConfirmation() async {
        phase = .saved
        ProductAnalytics.track("saved_confirmation_shown")
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif

        try? await Task.sleep(for: .seconds(savedHoldSeconds))
    }

    // Shows a +n pill on every tab whose count grew and returns the total added.
    private func showTabDeltas(from before: TaskCounts, to after: TaskCounts) -> Int {
        var deltas: [TaskBucket: Int] = [:]
        for bucket in TaskBucket.allCases {
            let delta = after.count(in: bucket) - before.count(in: bucket)
            if delta > 0 {
                deltas[bucket] = delta
            }
        }

        let added = deltas.values.reduce(0, +)
        guard added > 0 else { return 0 }

        tabDeltaGeneration += 1
        let generation = tabDeltaGeneration
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) {
            tabDeltas = deltas
        }

        Task {
            try? await Task.sleep(for: .seconds(tabDeltaSeconds))
            guard tabDeltaGeneration == generation else { return }
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.25)) {
                tabDeltas = [:]
            }
        }

        return added
    }

    // MARK: - Refresh

    private func refreshFromBackend() async {
        guard !isRefreshing else { return }

        isRefreshing = true
        defer { isRefreshing = false }

        await refreshNotes()
        _ = await refreshTasks()
    }

    private func refreshNotes() async {
        do {
            let notes = try await UploadClient().listNotes()
            appState.replaceNotes(notes)
            uploadError = nil
        } catch {
            if appState.notes.isEmpty {
                uploadError = error.localizedDescription
            }
        }
    }

    private func refreshTasks() async -> Bool {
        do {
            let list = try await UploadClient().fetchTasks(
                date: TaskListResponse.localDate(),
                timeZone: TaskListResponse.timeZoneIdentifier
            )
            appState.applyTaskList(list)
            return true
        } catch {
            if appState.taskList == nil {
                uploadError = error.localizedDescription
            }
            return false
        }
    }

    // The day boundary is evaluated on foreground: a cached list from an
    // earlier date is re-bucketed locally until GET /tasks answers.
    private func rederiveCachedListIfStale() {
        guard let list = appState.taskList else { return }

        let today = TaskListResponse.localDate()
        guard list.date != today else { return }

        appState.taskList = list.rederived(for: today)
        appState.taskListIsStale = true
    }

    private func refreshRecordingUntilSettled(id: String) async {
        let client = UploadClient()
        let settledStatuses = Set([
            "processed",
            "needs_transcript",
            "needs_extractor",
            "transcription_failed",
            "extraction_failed",
            "processing_failed"
        ])

        for attempt in 0..<10 {
            do {
                let recording = try await client.recording(id: id)
                appState.addUploadedNote(recording.displayNote())
                uploadError = nil

                if let status = recording.processingStatus, settledStatuses.contains(status) {
                    return
                }
            } catch {
                if attempt == 0 {
                    await refreshNotes()
                }
            }

            try? await Task.sleep(for: .seconds(attempt < 4 ? 2 : 5))
        }

        await refreshNotes()
    }

    private func recordingDurationBucket(_ seconds: Int) -> String {
        switch seconds {
        case ..<15: "under_15_seconds"
        case 15..<60: "15_to_59_seconds"
        case 60..<180: "1_to_2_minutes"
        default: "3_to_5_minutes"
        }
    }

    private static let failedProcessingStatuses = Set([
        "needs_transcript",
        "needs_extractor",
        "transcription_failed",
        "extraction_failed",
        "processing_failed"
    ])
}

private struct TaskTabStrip: View {
    let selected: TaskBucket
    let counts: TaskCounts?
    let deltas: [TaskBucket: Int]
    let onSelect: (TaskBucket) -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: 22) {
            ForEach(TaskBucket.allCases) { bucket in
                tab(for: bucket)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.border)
                .frame(height: 0.5)
        }
    }

    private func tab(for bucket: TaskBucket) -> some View {
        let isSelected = bucket == selected
        let count = counts?.count(in: bucket) ?? 0
        let delta = deltas[bucket] ?? 0

        return Button {
            onSelect(bucket)
        } label: {
            VStack(spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(bucket.title)
                        .font(.system(size: 15, weight: isSelected ? .medium : .regular))
                        .foregroundColor(isSelected ? Color.primary : Color.secondary)

                    if count > 0 {
                        Text("\(count)")
                            .font(.system(size: 11))
                            .monospacedDigit()
                            .foregroundStyle(.tertiary)
                    }

                    if delta > 0 {
                        Text("+\(delta)")
                            .font(.system(size: 11, weight: .medium))
                            .monospacedDigit()
                            .foregroundColor(Theme.blue)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(Theme.pillBackground)
                            .clipShape(Capsule())
                            .transition(.opacity)
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 12)

                Rectangle()
                    .fill(isSelected ? Theme.blue : Color.clear)
                    .frame(height: 2)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel(for: bucket, count: count))
        .accessibilityAddTraits(isSelected ? AccessibilityTraits.isSelected : AccessibilityTraits())
    }

    private func accessibilityLabel(for bucket: TaskBucket, count: Int) -> String {
        count == 1 ? "\(bucket.title), 1 item" : "\(bucket.title), \(count) items"
    }
}
