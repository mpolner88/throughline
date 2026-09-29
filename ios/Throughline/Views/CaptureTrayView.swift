import SwiftUI
import UIKit

struct CaptureTrayView: View {
    @EnvironmentObject private var queue: CaptureQueue
    var isRecording: Bool = false
    @EnvironmentObject private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var onSignIn: () -> Void
    @State private var expanded = false
    @State private var contentHeight: CGFloat = 0
    @State private var pendingDiscard: CaptureRecord?
    @State private var discardingOtherOwners = false
    @State private var discardFailed = false
    @State private var retryingDeletion = false
    @State private var deletionFailure = false

    private var rows: [CaptureRecord] { expanded ? queue.visibleCaptures : Array(queue.visibleCaptures.prefix(3)) }
    private var count: Int { queue.visibleCaptures.count }
    private var waitingCount: Int { queue.visibleCaptures.filter { $0.isUnsaved && $0.state != .confirmedUnreadable }.count }
    private var announcements: [UUID: String] {
        Dictionary(uniqueKeysWithValues: queue.captures.filter { $0.ownerID == queue.ownerID }.compactMap { capture in
            if capture.terminalIntent != nil { return nil }
            if capture.state == .finished {
                guard let id = capture.receipt?.recordingID,
                      appState.notes.contains(where: { $0.id == id && $0.processingStatus == "processed" }) else { return nil }
                return (capture.id, "Note ready in today's plan.")
            }
            if queue.deletionPending { return (capture.id, "Account deletion not confirmed. \(waitingCount) \(waitingCount == 1 ? "capture" : "captures") held on this phone.") }
            if queue.signInRequired { return (capture.id, "Sign in to save \(waitingCount) \(waitingCount == 1 ? "capture" : "captures").") }
            if capture.state == .checkingAudio { return (capture.id, "Recording kept on your phone. Checking it.") }
            if capture.state == .confirmedUnreadable { return (capture.id, "Recording interrupted. The audio couldn't be recovered.") }
            if capture.state == .failed || capture.state == .saved { return (capture.id, fact(capture) + " " + activity(capture)) }
            if capture.stoppedEarly { return (capture.id, "Recording stopped early. Kept on your phone.") }
            return nil
        })
    }
    private var maximumHeight: CGFloat { UIScreen.main.bounds.height / 2 }

    var body: some View {
        Group {
            if count > 0 || queue.otherOwnerCaptureCount > 0 {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if (waitingCount > 1 && queue.isOffline) || queue.signInRequired || queue.deletionPending { header }
                        ForEach(rows) { capture in
                            row(capture).transition(reduceMotion ? .opacity : .asymmetric(insertion: .opacity, removal: .move(edge: .top).combined(with: .opacity)))
                        }
                        .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: rows.map(\.id))
                        if count > 3 {
                            Button {
                                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) { expanded.toggle() }
                            } label: {
                                HStack {
                                    if !expanded { Text("+ \(count - 3) more") }
                                    Spacer()
                                    Text(expanded ? "Show less" : "Show all")
                                }.frame(minHeight: 44).contentShape(Rectangle())
                            }.buttonStyle(.plain).foregroundStyle(Theme.blue).padding(.horizontal, 24)
                        }
                        if queue.otherOwnerCaptureCount > 0 { otherOwnersRow }
                    }
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
                }
                .frame(height: min(maximumHeight, contentHeight > 0 ? contentHeight : 120))
                .scrollBounceBehavior(.basedOnSize)
                .accessibilityElement(children: .contain)
                .accessibilityLabel(count > 0 ? "Captures, \(count) \(count == 1 ? "item" : "items")" : "Captures from another account")
            } else { Divider() }
        }
        .confirmationDialog("Discard this capture?", isPresented: Binding(get: { pendingDiscard != nil }, set: { if !$0 { pendingDiscard = nil } }), titleVisibility: .visible) {
            if let capture = pendingDiscard {
                Button("Discard from phone", role: .destructive) { discard(capture.id) }
                Button("Cancel", role: .cancel) { pendingDiscard = nil }
            }
        } message: {
            Text(pendingDiscard?.hasEverDispatched == true
                 ? "This deletes the audio from this phone only. If it already reached your account, the note will still appear in your list."
                 : "The audio will be deleted from this phone. It hasn't been saved to your account.")
        }
        .confirmationDialog("Discard \(queue.otherOwnerCaptureCount) \(queue.otherOwnerCaptureCount == 1 ? "capture" : "captures") from another account?", isPresented: $discardingOtherOwners, titleVisibility: .visible) {
            Button("Discard from phone", role: .destructive) {
                do { try queue.discardOtherOwners() } catch { discardFailed = true }
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("They'll be deleted from this phone. Any that already reached that account stay there.")
        }
        .alert("Couldn't discard this capture", isPresented: $discardFailed) {
            Button("OK", role: .cancel) { }
        } message: { Text("It's still on your phone. Try again in a moment.") }
        .alert("Couldn't delete your account", isPresented: $deletionFailure) {
            Button("OK", role: .cancel) {}
        } message: { Text("Nothing was deleted. Try again in a moment.") }
        .onChange(of: Set(queue.visibleCaptures.filter { $0.state == .failed || $0.state == .confirmedUnreadable }.map(\.id))) { old, new in
            if scenePhase == .active && !new.subtracting(old).isEmpty { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
        }
        .onChange(of: announcements) { old, new in
            guard scenePhase == .active else { return }
            let changes = queue.captures.compactMap { capture -> String? in
                guard let message = new[capture.id], old[capture.id] != message else { return nil }
                return message
            }
            if let message = changes.first {
                if UIAccessibility.isVoiceOverRunning { UIAccessibility.post(notification: .announcement, argument: message) }
            }
        }
    }

    private var header: some View {
        VStack(spacing: 0) {
            Divider()
            let label = queue.deletionPending ? "Account deletion not confirmed" : "\(waitingCount) \(waitingCount == 1 ? "capture" : "captures") waiting to save"
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 12) { headerText(label); Spacer(minLength: 4); headerAction }
                VStack(alignment: .leading, spacing: 0) { headerText(label); headerAction }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 24).padding(.vertical, 4)
        }
    }

    private func headerText(_ text: String) -> some View {
        Text(text).font(.caption).tracking(1.2).textCase(.uppercase)
            .foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder private var headerAction: some View {
        if queue.deletionPending {
            Button {
                guard !retryingDeletion else { return }
                retryingDeletion = true
                Task {
                    let result = await queue.deleteAccount()
                    retryingDeletion = false
                    if case .refused = result { deletionFailure = true }
                }
            } label: {
                HStack { if retryingDeletion { ProgressView() }; Text("Try again") }
                    .frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
            }.buttonStyle(.plain).foregroundStyle(Theme.blue).disabled(retryingDeletion)
        } else if queue.signInRequired {
            Button(action: onSignIn) {
                Text("Sign in").frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
            }.buttonStyle(.plain).foregroundStyle(Theme.blue)
        }
    }

    @ViewBuilder private func glyph(_ capture: CaptureRecord) -> some View {
        Group {
            if capture.state == .confirmedUnreadable || (capture.state == .failed && !queue.deletionPending && !queue.signInRequired) {
                Image(systemName: "exclamationmark.circle").resizable().scaledToFit().frame(width: 14, height: 14).foregroundStyle(.secondary)
            } else if capture.state == .saved {
                if reduceMotion { Image(systemName: "circle.dotted").resizable().scaledToFit().frame(width: 14, height: 14).foregroundStyle(.secondary) }
                else { ProgressView().controlSize(.mini) }
            } else if queue.deletionPending || queue.signInRequired || queue.isOffline || capture.state == .checkingAudio {
                Circle().strokeBorder(Color.secondary, lineWidth: 1.5).frame(width: 12, height: 12)
            } else { Circle().fill(Theme.blue).frame(width: 8, height: 8) }
        }.frame(width: 14, height: 18).accessibilityHidden(true)
    }

    private func row(_ capture: CaptureRecord) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Divider()
            Group {
                if typeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) { glyph(capture); durationLabel(capture) }
                        rowMessage(capture)
                    }
                } else {
                    HStack(alignment: .top, spacing: 10) {
                        glyph(capture)
                        durationLabel(capture)
                        rowMessage(capture)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(.horizontal, 24).padding(.vertical, 14)
            .accessibilityElement(children: .combine)
            if capture.state == .confirmedUnreadable {
                Button { discard(capture.id) } label: { actionLabel("Dismiss", style: .quiet) }
                    .buttonStyle(.plain).padding(.horizontal, 24)
            } else if capture.state == .failed && !queue.deletionPending && !queue.signInRequired {
                if typeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 0) { actions(capture) }.padding(.horizontal, 24)
                } else {
                    HStack(spacing: 8) { actions(capture); Spacer(minLength: 0) }.padding(.horizontal, 24)
                }
            }
        }
    }

    @ViewBuilder private func durationLabel(_ capture: CaptureRecord) -> some View {
        if capture.duration > 0 || capture.state != .confirmedUnreadable {
            Text(duration(capture.duration)).font(.subheadline.monospacedDigit()).fixedSize()
                .accessibilityLabel(capture.duration < 60 ? "\(capture.duration) seconds" : "\(capture.duration / 60) minutes, \(capture.duration % 60) seconds")
        }
    }

    private func rowMessage(_ capture: CaptureRecord) -> some View {
        (Text(fact(capture)).fontWeight(.medium) + Text(" " + activity(capture)).foregroundColor(.secondary))
            .font(.subheadline).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private enum ActionStyle { case primary, outline, quiet }
    private func actionLabel(_ text: String, symbol: String? = nil, style: ActionStyle) -> some View {
        HStack(spacing: 6) { if let symbol { Image(systemName: symbol) }; Text(text) }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12).frame(maxWidth: typeSize.isAccessibilitySize ? .infinity : nil, minHeight: 44)
            .foregroundStyle(style == .primary ? Color.white : (style == .quiet ? Color.secondary : Color.primary))
            .background(style == .primary ? Theme.blue : Color.clear, in: RoundedRectangle(cornerRadius: Theme.cardRadius))
            .overlay { if style == .outline { RoundedRectangle(cornerRadius: Theme.cardRadius).stroke(Theme.border, lineWidth: 0.7) } }
            .contentShape(Rectangle())
    }

    @ViewBuilder private func actions(_ capture: CaptureRecord) -> some View {
        Button { queue.retry(id: capture.id) } label: { actionLabel("Save again", style: .primary) }.buttonStyle(.plain)
        Button {
            if queue.playingCaptureID == capture.id { queue.stopPlayback() } else { queue.play(id: capture.id) }
        } label: { actionLabel(queue.playingCaptureID == capture.id ? "Stop" : "Play", symbol: queue.playingCaptureID == capture.id ? "stop.fill" : "play.fill", style: .outline) }.buttonStyle(.plain)
        Button { pendingDiscard = capture } label: { actionLabel("Discard", style: .quiet) }.buttonStyle(.plain)
    }

    private var otherOwnersRow: some View {
        VStack(alignment: .leading, spacing: 4) {
            Divider()
            (Text("\(queue.otherOwnerCaptureCount) \(queue.otherOwnerCaptureCount == 1 ? "capture" : "captures") from another account. ").fontWeight(.medium)
             + Text("Sign in to that account to save them.").foregroundColor(.secondary))
                .font(.subheadline).fixedSize(horizontal: false, vertical: true).padding(.top, 14)
            Button { discardingOtherOwners = true } label: { actionLabel("Discard from phone", style: .quiet) }.buttonStyle(.plain)
        }.padding(.horizontal, 24)
    }

    private func fact(_ capture: CaptureRecord) -> String {
        if capture.state == .confirmedUnreadable { return "Recording interrupted." }
        if capture.state == .saved { return isRecording ? "Saved." : "Saved to your account." }
        if capture.state == .failed && !queue.deletionPending && !queue.signInRequired {
            return capture.hasEverDispatched ? "Couldn't confirm the save." : "Couldn't save."
        }
        return "On your phone."
    }

    private func activity(_ capture: CaptureRecord) -> String {
        if capture.state == .confirmedUnreadable { return "The audio couldn't be recovered." }
        if capture.state == .saved { return isRecording ? "Structuring…" : "Structuring your note…" }
        if isRecording && capture.state != .failed {
            if queue.deletionPending { return "Held." }
            if queue.signInRequired || queue.isOffline { return "Waiting." }
            if capture.state == .checkingAudio || capture.state == .checkingAccount { return "Checking…" }
            return "Saving…"
        }
        if queue.deletionPending { return "Held, not sent." }
        if queue.signInRequired || capture.state == .signInRequired { return "Waiting for sign-in." }
        if capture.state == .checkingAudio { return "Checking the recording…" }
        if capture.state == .failed { return "Still on your phone." }
        if queue.isOffline { return "Waiting for connection." }
        if capture.state == .checkingAccount { return "Checking with your account…" }
        return capture.stoppedEarly ? "Stopped early. Saving to your account…" : "Saving to your account…"
    }

    private func duration(_ seconds: Int) -> String { "\(seconds / 60):\(String(format: "%02d", seconds % 60))" }
    private func discard(_ id: UUID) {
        do { try queue.discard(id: id) } catch { discardFailed = true }
        pendingDiscard = nil
    }
}
