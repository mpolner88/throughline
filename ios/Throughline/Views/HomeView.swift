import SwiftUI

private enum FeedbackStatus: Equatable {
    case sending
    case sent
    case failed
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

                    ForEach(appState.latestNotes) { note in
                        CapturedCard(
                            note: note,
                            label: note.type.displayName,
                            feedbackStatus: feedbackStatus[note.id],
                            onFeedback: { sendFeedback(for: note, agentReady: $0) },
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

    private func sendFeedback(for note: ThroughlineNote, agentReady: Bool) {
        guard note.id.hasPrefix("rec_") else { return }

        feedbackStatus[note.id] = .sending
        Task {
            do {
                _ = try await UploadClient().sendFeedback(
                    recordingID: note.id,
                    agentReady: agentReady,
                    shouldRemember: true
                )
                feedbackStatus[note.id] = .sent
            } catch {
                feedbackStatus[note.id] = .failed
            }
        }
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

private struct CapturedCard: View {
    let note: ThroughlineNote
    let label: String
    let feedbackStatus: FeedbackStatus?
    let onFeedback: (Bool) -> Void
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

            Text(note.summary)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .lineSpacing(4)

            if !transcriptText.isEmpty {
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

            if note.id.hasPrefix("rec_") {
                FeedbackPrompt(status: feedbackStatus, onFeedback: onFeedback)
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

private struct FeedbackPrompt: View {
    let status: FeedbackStatus?
    let onFeedback: (Bool) -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text("Save recording")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)

            Spacer()

            if status == .sent {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Theme.blue)
                    .accessibilityLabel("Feedback sent")
            } else {
                feedbackButton(systemName: "checkmark", label: "Yes", agentReady: true)
                feedbackButton(systemName: "xmark", label: "No", agentReady: false)
            }
        }
        .padding(.top, 2)
    }

    private func feedbackButton(systemName: String, label: String, agentReady: Bool) -> some View {
        Button {
            onFeedback(agentReady)
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 30, height: 30)
                .background(
                    Circle()
                        .stroke(Theme.border, lineWidth: 0.5)
                )
        }
        .buttonStyle(.plain)
        .foregroundStyle(status == .sending ? .secondary : .primary)
        .disabled(status == .sending)
        .accessibilityLabel(label)
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
