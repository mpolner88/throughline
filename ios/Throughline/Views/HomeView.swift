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
    @StateObject private var recorder = AudioRecorder()
    @State private var uploadError: String?
    @State private var feedbackStatus: [String: FeedbackStatus] = [:]
    @State private var showingSettings = false
    @State private var isRefreshing = false
    @State private var isFinishingRecording = false
    @State private var isUploading = false
    @State private var isProcessing = false
    @State private var didJustSave = false
    @State private var selectedNote: ThroughlineNote?
    private let maxRecordingSeconds = 300

    var body: some View {
        VStack(spacing: 0) {
            topBar

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    dateBlock

                    if !appState.carriedForwardItems.isEmpty {
                        CarryForwardView(items: appState.carriedForwardItems)
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

                    ForEach(appState.latestNotes) { note in
                        CapturedCard(
                            note: note,
                            label: note.type.displayName,
                            feedbackStatus: feedbackStatus[note.id],
                            onOpen: { selectedNote = note },
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

                    if appState.notes.isEmpty && appState.carriedForwardItems.isEmpty {
                        Spacer(minLength: 220)
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
            await recorder.requestPermissionIfNeeded()
            await refreshFromBackend()
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
                .font(.throughlineHeading)
        }
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
                isBusy: isFinishingRecording || isUploading || isProcessing,
                size: 56
            ) {
                handleRecordTap()
            }
            .disabled(isFinishingRecording || isUploading || isProcessing)

            Text(recorderStatusText)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .padding(.top, 12)
        .padding(.bottom, 22)
        .background(.background)
    }

    private func handleRecordTap() {
        guard !isFinishingRecording, !isUploading, !isProcessing else { return }

        if recorder.isRecording {
            stopAndUploadRecording()
        } else {
            do {
                didJustSave = false
                try recorder.start(limitSeconds: nil)
            } catch {
                uploadError = error.localizedDescription
            }
        }
    }

    private var recorderStatusText: String {
        if recorder.isRecording {
            return "\(recorder.elapsedText) / 5:00"
        }

        if isFinishingRecording {
            return "finishing"
        }

        if isUploading {
            return "saving"
        }

        if isProcessing {
            return "translating"
        }

        if isRefreshing {
            return "syncing"
        }

        if didJustSave {
            return "saved"
        }

        return "tap to record"
    }

    private var mostImportantItems: [ImportantItem] {
        var items: [ImportantItem] = []
        var seen = Set<String>()

        for note in appState.latestNotes {
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

        Task {
            do {
                let recording = try await UploadClient().updateActionItem(
                    recordingID: item.recordingID,
                    text: item.text,
                    isCompleted: isCompleted
                )
                let updatedNote = recording.displayNote()
                appState.addUploadedNote(updatedNote)
                if selectedNote?.id == updatedNote.id {
                    selectedNote = updatedNote
                }
                uploadError = nil
            } catch {
                uploadError = error.localizedDescription
            }
        }
    }

    private func stopAndUploadRecording() {
        guard recorder.isRecording, !isFinishingRecording, !isUploading, !isProcessing else { return }

        Task {
            do {
                didJustSave = false
                isFinishingRecording = true
                let duration = min(recorder.elapsedSeconds, maxRecordingSeconds)
                let fileURL = try await recorder.stop()

                isFinishingRecording = false
                isUploading = true

                let response = try await UploadClient().uploadRecording(
                    fileURL: fileURL,
                    duration: duration,
                    type: .freeform,
                    processingMode: .async
                )

                isUploading = false
                appState.addUploadedNote(response.displayNote)
                uploadError = nil
                didJustSave = true
                isProcessing = true
                await refreshRecordingUntilSettled(id: response.id)
                await refreshFromBackend()
                isProcessing = false
            } catch {
                isFinishingRecording = false
                isUploading = false
                isProcessing = false
                didJustSave = false
                uploadError = error.localizedDescription
                await refreshFromBackend()
            }
        }
    }

    private func refreshFromBackend() async {
        guard !isRefreshing else { return }

        isRefreshing = true
        defer { isRefreshing = false }

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
                    await refreshFromBackend()
                }
            }

            try? await Task.sleep(for: .seconds(attempt < 4 ? 2 : 5))
        }

        await refreshFromBackend()
    }

    private func sendFeedback(
        for note: ThroughlineNote,
        qualityScore: Int,
        issueTypes: [String] = [],
        correction: String? = nil
    ) {
        guard note.id.hasPrefix("rec_") else { return }

        feedbackStatus[note.id] = .sending
        Task {
            do {
                _ = try await UploadClient().sendFeedback(
                    recordingID: note.id,
                    qualityScore: qualityScore,
                    issueTypes: issueTypes,
                    correction: correction,
                    shouldRemember: true
                )
                feedbackStatus[note.id] = .sent(qualityScore)
            } catch {
                feedbackStatus[note.id] = .failed
            }
        }
    }

    private func saveEdits(for note: ThroughlineNote, draft: NoteEditDraft) async throws -> ThroughlineNote {
        let recording = try await UploadClient().updateRecording(recordingID: note.id, draft: draft)
        let updatedNote = recording.displayNote()
        appState.addUploadedNote(updatedNote)
        if selectedNote?.id == updatedNote.id {
            selectedNote = updatedNote
        }
        uploadError = nil
        return updatedNote
    }

    private func delete(note: ThroughlineNote) {
        guard note.id.hasPrefix("rec_") else {
            appState.removeNote(id: note.id)
            return
        }

        Task {
            do {
                try await UploadClient().deleteRecording(id: note.id)
                appState.removeNote(id: note.id)
                uploadError = nil
            } catch {
                uploadError = error.localizedDescription
            }
        }
    }
}

private struct CarryForwardView: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "carried forward · last night")
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
                    .stroke(Theme.border, lineWidth: 0.5)
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
                        NoteEditForm(draft: $draft, error: editError)
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
                DetailedExtractionFeedbackView(
                    status: feedbackStatus,
                    onSubmit: onFeedback
                )
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

private struct NoteEditForm: View {
    @Binding var draft: NoteEditDraft
    let error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            EditTextField(title: "title", text: $draft.title)
            EditTextEditor(title: "summary", text: $draft.summary, minHeight: 110)
            EditTextEditor(title: "most important", text: $draft.mostImportantText, minHeight: 128)
            EditTextEditor(title: "to-dos", text: $draft.todosText, minHeight: 112)
            EditTextEditor(title: "transcript", text: $draft.transcript, minHeight: 220)

            if let error {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(.red)
                    .lineSpacing(3)
            }
        }
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
