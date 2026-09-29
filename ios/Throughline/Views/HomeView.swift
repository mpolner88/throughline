import AVFoundation
import SwiftUI

private enum FeedbackStatus: Equatable {
    case sending
    case sent(Int)
    case failed

    var savedScore: Int? {
        if case let .sent(score) = self {
            return score
        }

        return nil
    }
}

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var recorder: AudioRecorder
    @EnvironmentObject private var captureQueue: CaptureQueue
    @State private var showingCaptureSignIn = false
    @State private var microphoneDenied = false
    @Environment(\.scenePhase) private var scenePhase
    @State private var showingAIProcessingConsent = false
    @State private var aiContinuation = AIProcessingContinuation()
    @State private var isVisible = false
    @State private var uploadError: String?
    @State private var feedbackStatus: [String: FeedbackStatus] = [:]
    @State private var showingSettings = false
    @State private var isRefreshing = false
    @State private var selectedNote: ThroughlineNote?
    private let maxRecordingSeconds = 300

    var body: some View {
        VStack(spacing: 0) {
            topBar

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    dateBlock

                    if isHomeEmpty {
                        EmptyHomeContent(isDeemphasized: isShowingRecording || isShowingProcessing)
                    } else {
                        Text("Today’s plan")
                            .font(.throughlineHeading)

                        if !visibleCarryForwardItems.isEmpty {
                            CarryForwardView(items: visibleCarryForwardItems)
                        }

                        let importantItems = mostImportantItems
                        if !importantItems.isEmpty {
                            MostImportantView(
                                items: importantItems,
                                onToggle: { item, isCompleted in
                                    setActionItem(item, isCompleted: isCompleted)
                                }
                            )
                        }

                        ForEach(visibleNotes) { note in
                            CapturedCard(
                                note: note,
                                label: note.type.displayName,
                                feedbackStatus: feedbackStatus[note.id],
                                onOpen: {
                                    ProductAnalytics.track("note_opened")
                                    selectedNote = note
                                },
                                onToggleImportant: { actionItem, isCompleted in
                                    setActionItem(
                                        ImportantItem(
                                            id: "\(note.id)-\(actionItem.id)",
                                            recordingID: note.id,
                                            text: actionItem.text,
                                            noteTitle: note.title,
                                            createdAt: note.createdAt,
                                            isCompleted: actionItem.isCompleted
                                        ),
                                        isCompleted: isCompleted
                                    )
                                },
                                onFeedback: { sendFeedback(for: note, qualityScore: $0) },
                                onDelete: { delete(note: note) }
                            )
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            .refreshable {
                await refreshFromBackend()
            }

            bottomRecorder
        }
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains(where: { $0.hasPrefix("--throughline-preview-") }) {
                return
            }
            #endif
            await refreshFromBackend()
            ProductAnalytics.track(
                "home_viewed",
                properties: ["state": isHomeEmpty ? "empty" : "populated"]
            )
        }
        .onAppear {
            isVisible = true
            microphoneDenied = AVAudioApplication.shared.recordPermission == .denied
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--throughline-preview-mic-off") { microphoneDenied = true }
            #endif
            Task { await captureQueue.setForeground(true) }
        }
        .onDisappear { isVisible = false; Task { await captureQueue.setForeground(false) } }
        .onChange(of: scenePhase) { _, phase in
            Task {
                if phase == .active {
                    microphoneDenied = AVAudioApplication.shared.recordPermission == .denied
                    #if DEBUG
                    if ProcessInfo.processInfo.arguments.contains("--throughline-preview-mic-off") { microphoneDenied = true }
                    #endif
                    await captureQueue.setForeground(true)
                    await refreshFromBackend()
                } else {
                    await captureQueue.setForeground(false)
                }
            }
        }
        .sheet(isPresented: $showingCaptureSignIn) {
            NavigationStack {
                OnboardingView(signInOnly: true) {
                    showingCaptureSignIn = false
                    Task { await captureQueue.resume(); await refreshFromBackend() }
                }
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingCaptureSignIn = false } } }
            }
        }
        .sheet(isPresented: $showingAIProcessingConsent, onDismiss: {
            if aiContinuation.consume(generation: appState.accountGeneration,
                                      isActive: isVisible && scenePhase == .active) == .recording {
                startRecording()
            }
        }) {
            AIProcessingConsentView(onAgree: { aiContinuation.agree() })
        }
        .onChange(of: recorder.elapsedSeconds) { _, elapsedSeconds in
            if recorder.isRecording && elapsedSeconds >= maxRecordingSeconds {
                stopAndUploadRecording()
            }
        }
        .sheet(isPresented: $showingSettings) {
            AccountSettingsView()
        }
        .sheet(item: $selectedNote) { note in
            NoteDetailSheet(
                note: note,
                feedbackStatus: feedbackStatus[note.id],
                onToggleImportant: { actionItem, isCompleted in
                    setActionItem(
                        ImportantItem(
                            id: "\(note.id)-\(actionItem.id)",
                            recordingID: note.id,
                            text: actionItem.text,
                            noteTitle: note.title,
                            createdAt: note.createdAt,
                            isCompleted: actionItem.isCompleted
                        ),
                        isCompleted: isCompleted
                    )
                },
                onFeedback: { score, issueTypes, correction in
                    sendFeedback(
                        for: note,
                        qualityScore: score,
                        issueTypes: issueTypes,
                        correction: correction
                    )
                },
                onSaveEdits: { draft in
                    try await saveEdits(for: note, draft: draft)
                },
                onDelete: {
                    delete(note: note)
                    selectedNote = nil
                }
            )
        }
    }

    private var topBar: some View {
        HStack {
            Wordmark()
            Spacer()

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

    private var dateBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "today")
            Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.system(size: 16, weight: .medium))
        }
    }

    private var visibleNotes: [ThroughlineNote] {
        appState.latestNotes.filter { note in
            !captureQueue.representedRecordingIDs.contains(note.id)
                && !captureQueue.representedCaptureIDs.contains(note.captureID?.lowercased() ?? "")
        }
    }

    private var visibleCarryForwardItems: [String] { visibleNotes.flatMap(\.tomorrowTodos) }

    private var bottomRecorder: some View {
        VStack(spacing: 9) {
            CaptureTrayView(isRecording: isShowingRecording, onSignIn: { showingCaptureSignIn = true })

            if let uploadError, !captureQueue.signInRequired, !captureQueue.deletionPending {
                Text(uploadError)
                    .font(.footnote).foregroundStyle(.red)
                    .multilineTextAlignment(.center).padding(.horizontal, 24)
            }

            if microphoneDenied {
                recorderNotice(title: "Microphone access is off", support: "Turn it on in Settings to record. Your notes are unaffected.", actionTitle: "Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                }
            } else if captureQueue.storageUnavailable || captureQueue.insufficientSpace {
                recorderNotice(title: captureQueue.insufficientSpace ? "Not enough space to record" : "Couldn't start recording",
                    support: captureQueue.insufficientSpace ? "Free up storage on this phone, then try again. Your notes are unaffected." : "Tap to try again. Your notes are unaffected.", actionTitle: nil) { startRecording() }
            } else {
                RecordButton(
                    isRecording: isShowingRecording,
                    isBusy: captureQueue.isPreparing || captureQueue.isFinishing,
                    title: recorderButtonTitle,
                    detail: recorderButtonDetail,
                    supportingText: recorderButtonSupportingText,
                    size: 56
                ) { handleRecordTap() }
                .disabled(captureQueue.isPreparing || captureQueue.isFinishing)
            }
            if isRefreshing {
                Text("syncing").font(.subheadline).foregroundStyle(.secondary).monospacedDigit()
            }
        }
        .padding(.top, 12).padding(.bottom, 22).background(.background)
    }

    private func recorderNotice(title: String, support: String, actionTitle: String?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                if microphoneDenied { Image(systemName: "mic.slash").font(.title2) }
                else {
                    HStack(spacing: 18) { Capsule().frame(width: 34, height: 5); Capsule().frame(width: 34, height: 5) }.frame(height: 24)
                }
                Text(title).font(.headline)
                Text(support).font(.subheadline).foregroundStyle(.white.opacity(0.86))
                if let actionTitle {
                    Text(actionTitle).font(.subheadline.weight(.medium)).foregroundStyle(Theme.blue)
                        .padding(.horizontal, 14).frame(minHeight: 44)
                        .background(.white, in: RoundedRectangle(cornerRadius: Theme.cardRadius))
                }
            }.multilineTextAlignment(.center).padding(18).frame(maxWidth: .infinity, minHeight: 92)
                .foregroundStyle(.white)
                .background(LinearGradient(colors: [Theme.liftedBlue, Theme.blue], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay { RoundedRectangle(cornerRadius: Theme.cardRadius).strokeBorder(.white.opacity(0.22), lineWidth: 1) }
                .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius))
                .contentShape(Rectangle())
        }.buttonStyle(.plain).padding(.horizontal, 24)
    }

    private func handleRecordTap() {
        guard !captureQueue.isPreparing, !captureQueue.isFinishing else { return }
        if recorder.isRecording { stopAndUploadRecording() }
        else {
            guard AIProcessingPermission.shared.isAllowed else {
                aiContinuation.begin(.recording, generation: appState.accountGeneration)
                showingAIProcessingConsent = true
                return
            }
            startRecording()
        }
    }

    private func startRecording() {
        guard isVisible, scenePhase == .active, AIProcessingPermission.shared.isAllowed else { return }
        Task {
            await captureQueue.startRecording(type: .freeform, limitSeconds: maxRecordingSeconds)
            microphoneDenied = AVAudioApplication.shared.recordPermission == .denied
        }
    }

    private var isHomeEmpty: Bool {
        !visibleNotes.contains { $0.processingStatus == nil || $0.processingStatus == "processed" }
            && visibleCarryForwardItems.isEmpty
    }
    private var isShowingRecording: Bool { recorder.isRecording || previewRecordingState }
    private var isShowingProcessing: Bool { previewProcessingState }
    private var recorderButtonTitle: String {
        if captureQueue.isFinishing { return "Finishing recording…" }
        if captureQueue.isPreparing { return "Preparing microphone…" }
        if isShowingRecording { return "Stop recording" }
        return isHomeEmpty ? "Record today’s plan" : "Start recording"
    }
    private var recorderButtonDetail: String? {
        guard isShowingRecording else { return nil }
        return previewRecordingState ? "0:18 / 5:00" : "\(recorder.elapsedText) / 5:00"
    }
    private var recorderButtonSupportingText: String? {
        isShowingRecording ? "Listening… Tap when you’re done" : nil
    }

    private var previewRecordingState: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("--throughline-preview-empty-home-recording")
        #else
        false
        #endif
    }

    private var previewProcessingState: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("--throughline-preview-empty-home-processing")
        #else
        false
        #endif
    }

    private var mostImportantItems: [ImportantItem] {
        var items: [ImportantItem] = []
        var seen = Set<String>()

        for note in visibleNotes {
            guard note.processingStatus == "processed" || note.processingStatus == nil else { continue }

            for actionItem in note.displayImportantActionItems {
                let key = actionItem.text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                guard !key.isEmpty, !seen.contains(key) else { continue }

                seen.insert(key)
                items.append(
                    ImportantItem(
                        id: "\(note.id)-\(items.count)",
                        recordingID: note.id,
                        text: actionItem.text,
                        noteTitle: note.title,
                        createdAt: note.createdAt,
                        isCompleted: actionItem.isCompleted
                    )
                )

                if items.count >= 6 {
                    return items
                }
            }
        }

        return items
    }

    private func setActionItem(_ item: ImportantItem, isCompleted: Bool) {
        guard item.recordingID.hasPrefix("rec_") else { return }

        let epoch = appState.accountGeneration
        Task {
            do {
                let recording = try await UploadClient().updateActionItem(
                    recordingID: item.recordingID,
                    text: item.text,
                    isCompleted: isCompleted
                )
                guard epoch == appState.accountGeneration else { return }
                let updatedNote = recording.displayNote()
                appState.addUploadedNote(updatedNote)
                if selectedNote?.id == updatedNote.id {
                    selectedNote = updatedNote
                }
                ProductAnalytics.track(
                    "action_item_toggled",
                    properties: ["completed": isCompleted ? "true" : "false"]
                )
                uploadError = nil
            } catch {
                guard epoch == appState.accountGeneration else { return }
                uploadError = error.localizedDescription
            }
        }
    }

    private func stopAndUploadRecording() {
        Task { await captureQueue.stopRecording() }
    }

    private func refreshFromBackend() async {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--throughline-preview-home") { return }
        #endif
        guard !isRefreshing else { return }
        let epoch = appState.accountGeneration
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let notes = try await UploadClient().listNotes()
            guard appState.accountGeneration == epoch else { return }
            await captureQueue.reconcile(notes: notes)
            guard appState.accountGeneration == epoch else { return }
            appState.replaceNotes(notes)
            uploadError = nil
        } catch {
            guard appState.accountGeneration == epoch else { return }
            await captureQueue.resume()
            if appState.notes.isEmpty && !captureQueue.signInRequired && !captureQueue.isOffline {
                uploadError = "Couldn't refresh your notes. Pull down to try again."
            }
        }
    }

    private func sendFeedback(
        for note: ThroughlineNote,
        qualityScore: Int,
        issueTypes: [String] = [],
        correction: String? = nil
    ) {
        guard note.id.hasPrefix("rec_") else { return }

        feedbackStatus[note.id] = .sending
        let epoch = appState.accountGeneration
        Task {
            do {
                _ = try await UploadClient().sendFeedback(
                    recordingID: note.id,
                    qualityScore: qualityScore,
                    issueTypes: issueTypes,
                    correction: correction,
                    shouldRemember: true
                )
                guard epoch == appState.accountGeneration else { return }
                feedbackStatus[note.id] = .sent(qualityScore)
                ProductAnalytics.track(
                    "feedback_submitted",
                    properties: [
                        "surface": "extraction_quality",
                        "score": String(qualityScore)
                    ]
                )
            } catch {
                guard epoch == appState.accountGeneration else { return }
                feedbackStatus[note.id] = .failed
            }
        }
    }

    private func saveEdits(for note: ThroughlineNote, draft: NoteEditDraft) async throws -> ThroughlineNote {
        let epoch = appState.accountGeneration
        let recording = try await UploadClient().updateRecording(
            recordingID: note.id,
            draft: draft,
            expectedRevisionID: note.currentRevisionID
        )
        guard epoch == appState.accountGeneration else { throw CancellationError() }
        let updatedNote = recording.displayNote()
        appState.addUploadedNote(updatedNote)
        if selectedNote?.id == updatedNote.id {
            selectedNote = updatedNote
        }
        ProductAnalytics.track("note_edited")
        uploadError = nil
        return updatedNote
    }

    private func delete(note: ThroughlineNote) {
        guard note.id.hasPrefix("rec_") else {
            appState.removeNote(id: note.id)
            return
        }

        let epoch = appState.accountGeneration
        Task {
            do {
                try await UploadClient().deleteRecording(id: note.id)
                guard epoch == appState.accountGeneration else { return }
                appState.removeNote(id: note.id)
                ProductAnalytics.track("note_deleted")
                uploadError = nil
            } catch {
                guard epoch == appState.accountGeneration else { return }
                uploadError = error.localizedDescription
            }
        }
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

private struct EmptyHomeContent: View {
    let isDeemphasized: Bool

    private let exampleItems = [
        "Ship the small thing first",
        "Walk again tonight",
        "Keep the morning light"
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            VStack(alignment: .leading, spacing: 14) {
                Text("Say today’s to-dos.")
                    .font(.throughlineHeading)

                Text("Speak naturally. Throughline turns your voice note into a clear, organized task list.")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(alignment: .leading, spacing: 12) {
                Eyebrow(text: "what you’ll get")

                VStack(spacing: 0) {
                    ForEach(Array(exampleItems.enumerated()), id: \.offset) { index, item in
                        HStack(spacing: 14) {
                            Image(systemName: "circle")
                                .font(.system(size: 17, weight: .regular))
                                .foregroundStyle(Theme.blue)
                                .accessibilityHidden(true)

                            Text(item)
                                .font(.system(size: 15, weight: .regular))

                            Spacer()
                        }
                        .frame(minHeight: 58)

                        if index < exampleItems.count - 1 {
                            Divider()
                        }
                    }
                }
            }

            HStack(alignment: .center, spacing: 10) {
                Image(systemName: "lock")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)

                Text("Readable by your AI agent after you connect MCP.")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
        }
        .opacity(isDeemphasized ? 0.38 : 1)
        .animation(.easeInOut(duration: 0.2), value: isDeemphasized)
        .accessibilityElement(children: .contain)
    }
}

private struct CarryForwardView: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "unfinished from last night")
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.leading, 14)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.blue)
                .frame(width: 1.5)
        }
    }
}

private struct ImportantItem: Identifiable {
    let id: String
    let recordingID: String
    let text: String
    let noteTitle: String
    let createdAt: Date
    let isCompleted: Bool
}

private struct MostImportantView: View {
    let items: [ImportantItem]
    let onToggle: (ImportantItem, Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "most important")

            VStack(alignment: .leading, spacing: 10) {
                ForEach(items) { item in
                    SwipeCompleteRow(item: item, onToggle: onToggle)
                }
            }
        }
    }
}

private struct SwipeCompleteRow: View {
    let item: ImportantItem
    let onToggle: (ImportantItem, Bool) -> Void
    @State private var horizontalOffset: CGFloat = 0

    private let completeThreshold: CGFloat = 76
    private var isShowingSwipeAction: Bool {
        horizontalOffset > 0.5
    }

    var body: some View {
        ZStack(alignment: .leading) {
            HStack {
                Image(systemName: item.isCompleted ? "arrow.uturn.left" : "checkmark")
                    .font(.system(size: 15, weight: .semibold))
                Text(item.isCompleted ? "Reopen" : "Done")
                    .font(.system(size: 13, weight: .medium))
                Spacer()
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(item.isCompleted ? Color.secondary : Theme.blue)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .opacity(isShowingSwipeAction ? 1 : 0)

            HStack(alignment: .top, spacing: 10) {
                Button {
                    onToggle(item, !item.isCompleted)
                } label: {
                    Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 19, weight: .medium))
                        .foregroundColor(item.isCompleted ? Theme.blue : Color.secondary)
                        .frame(width: 26, height: 26)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.isCompleted ? "Reopen item" : "Complete item")

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.text)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(item.isCompleted ? Color.secondary : Color.primary)
                        .strikethrough(item.isCompleted, color: .secondary)
                        .lineSpacing(3)

                    Text("\(item.noteTitle) · \(item.createdAt.formatted(.dateTime.hour().minute()))")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding(.vertical, 9)
            .padding(.horizontal, 11)
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(Theme.border, lineWidth: 0.7)
            }
            .offset(x: max(0, horizontalOffset))
            .gesture(
                DragGesture(minimumDistance: 18)
                    .onChanged { value in
                        guard abs(value.translation.width) > abs(value.translation.height) else { return }
                        horizontalOffset = max(0, min(value.translation.width, completeThreshold + 18))
                    }
                    .onEnded { value in
                        let shouldToggle = value.translation.width >= completeThreshold
                        withAnimation(.spring(response: 0.24, dampingFraction: 0.82)) {
                            horizontalOffset = 0
                        }

                        if shouldToggle {
                            onToggle(item, !item.isCompleted)
                        }
                    }
            )
        }
    }
}

private struct ImportantActionSection: View {
    let title: String
    let items: [ActionItem]
    let onToggle: (ActionItem, Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: title)

            ForEach(items) { item in
                HStack(alignment: .top, spacing: 8) {
                    Button {
                        onToggle(item, !item.isCompleted)
                    } label: {
                        Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(item.isCompleted ? Theme.blue : Color.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(item.isCompleted ? "Reopen item" : "Complete item")

                    Text(item.text)
                        .font(.system(size: 14))
                        .foregroundColor(item.isCompleted ? Color.secondary : Color.primary.opacity(0.86))
                        .strikethrough(item.isCompleted, color: .secondary)
                        .lineSpacing(3)
                }
            }
        }
    }
}

private struct CapturedCard: View {
    let note: ThroughlineNote
    let label: String
    let feedbackStatus: FeedbackStatus?
    let onOpen: () -> Void
    let onToggleImportant: (ActionItem, Bool) -> Void
    let onFeedback: (Int) -> Void
    let onDelete: () -> Void
    @State private var isConfirmingDelete = false

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Eyebrow(text: "\(label) · \(note.createdAt.formatted(.dateTime.hour().minute()))")
                    Text(note.title)
                        .font(.system(size: 19, weight: .medium))
                }

                Spacer()

                Button {
                    isConfirmingDelete = true
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14, weight: .medium))
                        .frame(width: 30, height: 30)
                        .background(
                            Circle()
                                .stroke(Theme.border, lineWidth: 0.5)
                        )
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Discard memory")
            }

            if let processingText = note.processingText {
                ProcessingStatusRow(text: processingText, isActive: note.isProcessing)
            }

            if !note.displayMostImportant.isEmpty {
                ImportantActionSection(
                    title: "most important",
                    items: Array(note.displayImportantActionItems.prefix(3)),
                    onToggle: onToggleImportant
                )
            }

            Text(note.previewText)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .lineSpacing(4)
                .lineLimit(4)

            if !transcriptText.isEmpty && transcriptText != note.previewText {
                VStack(alignment: .leading, spacing: 7) {
                    Eyebrow(text: "transcript")
                    Text(transcriptText)
                        .font(.system(size: 14))
                        .foregroundStyle(.primary.opacity(0.82))
                        .lineSpacing(4)
                        .lineLimit(8)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                if let mood = note.mood {
                    Pill(text: mood.rawValue, isMood: true)
                }

                ForEach(note.centersOfBalance, id: \.self) { center in
                    Pill(text: center)
                }
            }

            Button(action: onOpen) {
                HStack(spacing: 6) {
                    Text("Read full note")
                        .font(.system(size: 13, weight: .medium))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(Theme.blue)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Read full note")

            if note.id.hasPrefix("rec_") {
                ExtractionGradePrompt(status: feedbackStatus, onGrade: onFeedback)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay {
            RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                .stroke(Theme.border, lineWidth: 0.5)
        }
        .confirmationDialog("Discard this memory?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
            Button("Discard memory", role: .destructive) {
                onDelete()
            }
        }
    }

    private var transcriptText: String {
        note.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private struct ProcessingStatusRow: View {
    let text: String
    let isActive: Bool

    var body: some View {
        HStack(spacing: 9) {
            if isActive {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: "exclamationmark.circle")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }

            Text(text)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 10)
        .background(Theme.blue.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct ExtractedSection: View {
    let title: String
    let items: [String]
    var limit: Int? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: title)

            ForEach(Array(items.prefix(limit ?? items.count)), id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Circle()
                        .fill(Theme.blue)
                        .frame(width: 5, height: 5)
                        .padding(.top, 7)

                    Text(item)
                        .font(.system(size: 14))
                        .foregroundStyle(.primary.opacity(0.86))
                        .lineSpacing(3)
                }
            }
        }
    }
}

private struct ExtractionGradePrompt: View {
    let status: FeedbackStatus?
    let onGrade: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 10) {
                Text(statusText)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)

                Spacer()

                if status?.savedScore != nil {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Theme.blue)
                        .accessibilityLabel("Feedback saved")
                }
            }

            HStack(spacing: 6) {
                ForEach(1...5, id: \.self) { score in
                    gradeButton(score)
                }
            }
        }
        .padding(.top, 2)
    }

    private var statusText: String {
        if let score = status?.savedScore {
            return "Extraction grade saved: \(score)/5"
        }

        if status == .sending {
            return "Saving extraction grade"
        }

        if status == .failed {
            return "Could not save grade. Try again."
        }

        return "Grade extraction"
    }

    private func gradeButton(_ score: Int) -> some View {
        Button {
            onGrade(score)
        } label: {
            Text("\(score)")
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 32, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(status?.savedScore == score ? Theme.blue : Color.clear)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(Theme.border, lineWidth: 0.5)
                }
        }
        .buttonStyle(.plain)
        .foregroundColor(status?.savedScore == score ? Color.white : status == .sending ? Color.secondary : Color.primary)
        .disabled(status == .sending)
        .accessibilityLabel("Grade extraction \(score) out of 5")
    }
}

private struct NoteDetailSheet: View {
    let note: ThroughlineNote
    let feedbackStatus: FeedbackStatus?
    let onToggleImportant: (ActionItem, Bool) -> Void
    let onFeedback: (Int, [String], String?) -> Void
    let onSaveEdits: (NoteEditDraft) async throws -> ThroughlineNote
    let onDelete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var currentNote: ThroughlineNote
    @State private var draft: NoteEditDraft
    @State private var isEditing = false
    @State private var isSaving = false
    @State private var editError: String?

    init(
        note: ThroughlineNote,
        feedbackStatus: FeedbackStatus?,
        onToggleImportant: @escaping (ActionItem, Bool) -> Void,
        onFeedback: @escaping (Int, [String], String?) -> Void,
        onSaveEdits: @escaping (NoteEditDraft) async throws -> ThroughlineNote,
        onDelete: @escaping () -> Void
    ) {
        self.note = note
        self.feedbackStatus = feedbackStatus
        self.onToggleImportant = onToggleImportant
        self.onFeedback = onFeedback
        self.onSaveEdits = onSaveEdits
        self.onDelete = onDelete
        _currentNote = State(initialValue: note)
        _draft = State(initialValue: NoteEditDraft(note: note))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if isEditing {
                        NoteEditForm(
                            draft: $draft,
                            error: editError,
                            showsPrivateEvaluationDisclosure: currentNote.currentRevisionID != nil
                        )
                            .disabled(isSaving)
                    } else {
                        readOnlyContent
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            .navigationTitle("memory")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if currentNote.id.hasPrefix("rec_") {
                        Button(isEditing ? "Cancel" : "Edit") {
                            if isEditing {
                                cancelEditing()
                            } else {
                                draft = NoteEditDraft(note: currentNote)
                                editError = nil
                                isEditing = true
                            }
                        }
                        .disabled(isSaving)
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    if isEditing {
                        Button {
                            saveDraft()
                        } label: {
                            if isSaving {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Text("Save")
                            }
                        }
                        .disabled(isSaving || !draft.canSave)
                    } else {
                        Button("Done") {
                            dismiss()
                        }
                    }
                }
            }
        }
        .onChange(of: note) { _, newNote in
            currentNote = newNote
            if !isEditing {
                draft = NoteEditDraft(note: newNote)
            }
        }
    }

    private var readOnlyContent: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "\(currentNote.type.displayName) · \(currentNote.createdAt.formatted(.dateTime.weekday().month().day().hour().minute()))")
                Text(currentNote.title)
                    .font(.system(size: 24, weight: .medium))
                    .lineSpacing(2)
            }

            if let processingText = currentNote.processingText {
                ProcessingStatusRow(text: processingText, isActive: currentNote.isProcessing)
            }

            VStack(alignment: .leading, spacing: 8) {
                Eyebrow(text: "preview")
                Text(currentNote.summary)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
            }

            if !currentNote.displayMostImportant.isEmpty {
                ImportantActionSection(
                    title: "most important",
                    items: currentNote.displayImportantActionItems,
                    onToggle: onToggleImportant
                )
            }

            if !currentNote.todos.isEmpty {
                ExtractedSection(title: "to-dos", items: currentNote.todos.map(\.text))
            }

            if !currentNote.intentions.isEmpty {
                ExtractedSection(title: "notes", items: currentNote.intentions)
            }

            if !currentNote.accomplishments.isEmpty {
                ExtractedSection(title: "accomplishments", items: currentNote.accomplishments)
            }

            let transcriptText = currentNote.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            if !transcriptText.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Eyebrow(text: "transcript")
                    Text(transcriptText)
                        .font(.system(size: 15))
                        .lineSpacing(5)
                }
            }

            if currentNote.id.hasPrefix("rec_") {
                switch EvaluationRatingMode.resolve(currentRevisionID: currentNote.currentRevisionID) {
                case .privateLineage:
                    PrivateEvaluationView(note: currentNote)
                case .standard:
                    DetailedExtractionFeedbackView(
                        status: feedbackStatus,
                        onSubmit: onFeedback
                    )
                }
            }

            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Discard memory", systemImage: "trash")
                    .font(.system(size: 15, weight: .medium))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
    }

    private func cancelEditing() {
        draft = NoteEditDraft(note: currentNote)
        editError = nil
        isEditing = false
    }

    private func saveDraft() {
        guard !isSaving, draft.canSave else { return }

        isSaving = true
        editError = nil
        Task {
            do {
                let updatedNote = try await onSaveEdits(draft)
                currentNote = updatedNote
                draft = NoteEditDraft(note: updatedNote)
                isEditing = false
            } catch {
                editError = error.localizedDescription
            }
            isSaving = false
        }
    }
}

private enum EvaluationContributionPhase: Equatable {
    case idle
    case loadingPreview
    case saving
    case saved
    case removing
    case removed
    case failed(String)
}

private struct PrivateEvaluationView: View {
    let note: ThroughlineNote
    @State private var state = EvaluationContributionState()
    @State private var phase: EvaluationContributionPhase = .idle
    @State private var selectedScore: Int?
    @State private var selectedIssues = Set<String>()
    @State private var explanation = ""
    @State private var isPreviewExpanded = false
    @State private var isConfirmingRemoval = false

    private let issues: [(id: String, label: String)] = [
        ("missed_action", "Missed action"),
        ("unsupported_action", "Invented action"),
        ("wrong_importance", "Wrong importance"),
        ("meaning_changed", "Meaning changed"),
        ("weak_summary", "Weak summary"),
        ("transcription_error", "Transcript error"),
        ("schema_invalid", "Invalid structure"),
        ("other_structured", "Other structure")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "private quality check")

            RecordingPrivacyLink()

            if let revisionID = note.currentRevisionID, UUID(uuidString: revisionID) != nil {
                gradeControl
                previewControl(revisionID: revisionID)
                issueControl
                explanationControl
                saveControl(revisionID: revisionID)

                removalControl
            }
        }
        .padding(16)
        .background(Theme.blue.opacity(0.045))
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.border, lineWidth: 0.5)
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .task(id: note.currentRevisionID) {
            state.invalidateForNoteChange()
            phase = .idle
            isPreviewExpanded = false
        }
        .confirmationDialog("Remove this private quality contribution?", isPresented: $isConfirmingRemoval, titleVisibility: .visible) {
            Button(EvaluationContributionCopy.removalLabel, role: .destructive) { removeContribution() }
        } message: {
            Text(EvaluationContributionCopy.removalMeaning)
        }
    }

    private var gradeControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("How well did Throughline structure this note?")
                .font(.system(size: 14, weight: .medium))
            HStack(spacing: 7) {
                ForEach(1...5, id: \.self) { score in
                    Button { selectedScore = score } label: {
                        Text("\(score)")
                            .font(.system(size: 14, weight: .semibold))
                            .frame(width: 38, height: 34)
                            .background(RoundedRectangle(cornerRadius: 8).fill(selectedScore == score ? Theme.blue : Color.clear))
                            .overlay { RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 0.5) }
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(selectedScore == score ? .white : .primary)
                    .disabled(isBusy)
                    .accessibilityLabel("Grade private quality \(score) out of 5")
                }
            }
        }
    }

    private func previewControl(revisionID: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            DisclosureGroup(isExpanded: Binding(
                get: { isPreviewExpanded },
                set: { expanded in
                    isPreviewExpanded = expanded
                    guard expanded else { return }
                    if state.currentPreview == nil { loadPreview(revisionID: revisionID) }
                    else { state.recordPreviewPresented() }
                }
            )) {
                Group {
                    if phase == .loadingPreview {
                        ProgressView("Loading exact note output")
                    } else if let preview = state.currentPreview {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(preview.rows) { row in previewRow(row) }
                        }
                        .padding(.top, 8)
                        .onAppear { state.recordPreviewPresented() }
                    } else {
                        Text("Preview unavailable. Readiness stays off.")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }
                }
            } label: {
                VStack(alignment: .leading, spacing: 3) {
                    Text(EvaluationContributionCopy.previewTitle)
                        .font(.system(size: 15, weight: .medium))
                    Text(EvaluationContributionCopy.previewMeaning)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            }

            Toggle(EvaluationContributionCopy.readinessLabel, isOn: Binding(
                get: { state.readinessChoice == .accepted },
                set: { accepted in
                    if accepted { state.acceptReadiness() }
                    else { state.rejectReadiness() }
                }
            ))
            .disabled(!state.canAcceptReadiness || isBusy)

            Text(EvaluationContributionCopy.readinessMeaning)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
    }

    private func previewRow(_ row: CanonicalFieldPreviewRow) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(row.field.replacingOccurrences(of: "_", with: " "))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            ForEach(Array(row.inspectableLines.enumerated()), id: \.offset) { _, line in
                Text(line.hasPrefix(": ") ? String(line.dropFirst(2)) : line)
                    .font(.system(size: 13))
                    .foregroundStyle(.primary.opacity(0.86))
                    .textSelection(.enabled)
            }
        }
    }

    private var issueControl: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 126), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(issues, id: \.id) { issue in
                let selected = selectedIssues.contains(issue.id)
                Button {
                    if selected { selectedIssues.remove(issue.id) }
                    else { selectedIssues.insert(issue.id) }
                } label: {
                    Text(issue.label)
                        .font(.system(size: 13, weight: .medium))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 9)
                        .padding(.horizontal, 10)
                        .background(selected ? Theme.blue.opacity(0.12) : Color.clear)
                        .overlay { RoundedRectangle(cornerRadius: 8).stroke(selected ? Theme.blue : Theme.border, lineWidth: 0.7) }
                }
                .buttonStyle(.plain)
                .disabled(isBusy)
            }
        }
    }

    private var explanationControl: some View {
        VStack(alignment: .leading, spacing: 7) {
            TextEditor(text: $explanation)
                .font(.system(size: 13))
                .frame(minHeight: 72)
                .padding(7)
                .overlay { RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 0.5) }
                .accessibilityLabel("Optional private quality explanation")
            Text(EvaluationContributionCopy.explanationPrivacy)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
    }

    private func saveControl(revisionID: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Button { saveEvaluation(revisionID: revisionID) } label: {
                Text(phase == .saving ? "Saving private quality grade" : "Save private quality grade")
                    .font(.system(size: 15, weight: .medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(selectedScore == nil || isBusy ? Theme.border : Theme.blue)
                    .foregroundColor(selectedScore == nil || isBusy ? .secondary : .white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(selectedScore == nil || isBusy)

            if let statusMessage {
                Text(statusMessage).font(.system(size: 12)).foregroundStyle(phaseIsFailure ? .red : .secondary)
            }
        }
    }

    private var removalControl: some View {
        Button(role: .destructive) { isConfirmingRemoval = true } label: {
            Text(EvaluationContributionCopy.removalLabel).font(.system(size: 13, weight: .medium))
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }

    private var isBusy: Bool { phase == .loadingPreview || phase == .saving || phase == .removing }
    private var phaseIsFailure: Bool { if case .failed = phase { return true }; return false }
    private var statusMessage: String? {
        switch phase {
        case .saved: "Private quality contribution saved."
        case .removed: "Private quality contribution removed. Your visible note is unchanged."
        case let .failed(message): message
        default: nil
        }
    }

    private func loadPreview(revisionID: String) {
        phase = .loadingPreview
        Task {
            do {
                let preview = try await UploadClient().evaluationReadinessPreview(recordingID: note.id, revisionID: revisionID)
                guard preview.revisionID.lowercased() == revisionID.lowercased() else { throw UploadClientError.invalidResponse }
                state.loadPreview(preview)
                phase = .idle
            } catch { fail(error, message: "Could not load the exact output. Readiness stays off.") }
        }
    }

    private func saveEvaluation(revisionID: String) {
        guard let score = selectedScore, let revision = UUID(uuidString: revisionID) else { return }
        phase = .saving
        let trimmed = explanation.trimmingCharacters(in: .whitespacesAndNewlines)
        var request = EvaluationContributionRequest(evaluatedRevisionID: revision, score: score, issueCodes: Array(selectedIssues).sorted(), explanation: trimmed.isEmpty ? nil : trimmed)
        request = request.withPreview(state.boundPreview).withReadiness(state.readinessChoice)
        Task {
            do {
                _ = try await UploadClient().saveEvaluation(recordingID: note.id, request: request)
                state.recordContributionSaved()
                phase = .saved
            } catch { fail(error, message: "Could not save this private quality grade.") }
        }
    }

    private func removeContribution() {
        phase = .removing
        Task {
            do {
                _ = try await UploadClient().removeEvaluationContribution(recordingID: note.id)
                state.recordContributionRemoved()
                phase = .removed
            } catch { fail(error, message: "Could not remove the contribution. Try again.") }
        }
    }

    private func fail(_ error: Error, message: String) {
        if case UploadClientError.serverError(409, _) = error {
            state.invalidateForNoteChange()
            phase = .failed("The note changed. Open the refreshed preview before trying again.")
        } else {
            phase = .failed(message)
        }
    }
}

private struct NoteEditForm: View {

    @Binding var draft: NoteEditDraft
    let error: String?
    let showsPrivateEvaluationDisclosure: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            EditTextField(title: "title", text: $draft.title)
            EditTextEditor(title: "summary", text: $draft.summary, minHeight: 110)
            EditTextEditor(title: "most important", text: $draft.mostImportantText, minHeight: 128)
            EditTextEditor(title: "to-dos", text: $draft.todosText, minHeight: 112)
            EditTextEditor(title: "transcript", text: $draft.transcript, minHeight: 220)

            if showsPrivateEvaluationDisclosure {
                RecordingPrivacyLink()
            }

            if let error {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(.red)
                    .lineSpacing(3)
            }
        }
    }
}

private struct RecordingPrivacyLink: View {
    private let privacyURL = URL(string: "https://mpolner88.github.io/throughline/privacy/")!

    var body: some View {
        Link(EvaluationContributionCopy.privacyLinkLabel, destination: privacyURL)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Theme.blue)
    }
}

private struct EditTextField: View {
    let title: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: title)
            TextField(title, text: $text, axis: .vertical)
                .font(.system(size: 17, weight: .medium))
                .textFieldStyle(.plain)
                .padding(12)
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Theme.border, lineWidth: 0.5)
                }
        }
    }
}

private struct EditTextEditor: View {
    let title: String
    @Binding var text: String
    let minHeight: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: title)
            TextEditor(text: $text)
                .font(.system(size: 15))
                .lineSpacing(4)
                .scrollContentBackground(.hidden)
                .padding(8)
                .frame(minHeight: minHeight, alignment: .topLeading)
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Theme.border, lineWidth: 0.5)
                }
        }
    }
}

private struct DetailedExtractionFeedbackView: View {
    let status: FeedbackStatus?
    let onSubmit: (Int, [String], String?) -> Void
    @State private var selectedScore: Int?
    @State private var selectedIssues = Set<String>()
    @State private var correction = ""

    private let issues: [(id: String, label: String)] = [
        ("missed_actions", "Missed to-dos"),
        ("wrong_importance", "Wrong importance"),
        ("invented_detail", "Invented detail"),
        ("weak_summary", "Weak summary"),
        ("transcript_error", "Bad transcript")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "grade extraction")

            Text("Rate the memory extraction. Low scores and corrections become eval candidates.")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
                .lineSpacing(3)

            RecordingPrivacyLink()

            HStack(spacing: 7) {
                ForEach(1...5, id: \.self) { score in
                    Button {
                        selectedScore = score
                    } label: {
                        Text("\(score)")
                            .font(.system(size: 14, weight: .semibold))
                            .frame(width: 38, height: 34)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(selectedScore == score ? Theme.blue : Color.clear)
                            )
                            .overlay {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(Theme.border, lineWidth: 0.5)
                            }
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(selectedScore == score ? Color.white : Color.primary)
                    .accessibilityLabel("Grade extraction \(score) out of 5")
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 126), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(issues, id: \.id) { issue in
                    issueButton(issue)
                }
            }

            ZStack(alignment: .topLeading) {
                TextEditor(text: $correction)
                    .font(.system(size: 14))
                    .frame(minHeight: 88)
                    .padding(8)
                    .accessibilityLabel("Correction notes")

                if correction.isEmpty {
                    Text("What did it miss or get wrong?")
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                        .padding(.top, 16)
                        .padding(.leading, 13)
                        .allowsHitTesting(false)
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Theme.border, lineWidth: 0.5)
            }

            Button {
                guard let selectedScore else { return }
                let trimmedCorrection = correction.trimmingCharacters(in: .whitespacesAndNewlines)
                onSubmit(
                    selectedScore,
                    Array(selectedIssues).sorted(),
                    trimmedCorrection.isEmpty ? nil : trimmedCorrection
                )
            } label: {
                Text(buttonText)
                    .font(.system(size: 15, weight: .medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(selectedScore == nil || status == .sending ? Theme.border : Theme.blue)
                    .foregroundColor(selectedScore == nil || status == .sending ? Color.secondary : Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(selectedScore == nil || status == .sending)
        }
        .onAppear {
            selectedScore = status?.savedScore
        }
    }

    private var buttonText: String {
        if status == .sending {
            return "Saving grade"
        }

        if let score = status?.savedScore {
            return "Saved \(score)/5"
        }

        return "Save grade"
    }

    private func issueButton(_ issue: (id: String, label: String)) -> some View {
        let isSelected = selectedIssues.contains(issue.id)

        return Button {
            if isSelected {
                selectedIssues.remove(issue.id)
            } else {
                selectedIssues.insert(issue.id)
            }
        } label: {
            Text(issue.label)
                .font(.system(size: 13, weight: .medium))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 9)
                .padding(.horizontal, 10)
                .background(isSelected ? Theme.blue.opacity(0.12) : Color.clear)
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(isSelected ? Theme.blue : Theme.border, lineWidth: 0.7)
                }
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

private struct ThroughlineMarker: View {
    var body: some View {
        VStack(spacing: 0) {
            Circle()
                .fill(Theme.blue)
                .frame(width: 6, height: 6)
            Rectangle()
                .fill(Theme.blue)
                .frame(width: 1.5, height: 44)
            Circle()
                .fill(Theme.blue)
                .frame(width: 6, height: 6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 2)
    }
}
