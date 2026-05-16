import SwiftUI

struct Wordmark: View {
    var body: some View {
        Text("throughline")
            .font(.system(size: 17, weight: .medium))
            .tracking(0)
    }
}

struct Eyebrow: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .medium))
            .tracking(0.9)
            .foregroundStyle(.secondary)
    }
}

struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .medium))
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Theme.blue)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .medium))
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .overlay {
                    RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                        .stroke(Theme.border, lineWidth: 0.5)
                }
        }
        .buttonStyle(.plain)
    }
}

struct AccountSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var showingBackendSettings = false
    @State private var isConfirmingDelete = false
    @State private var isDeleting = false
    @State private var deleteError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("account") {
                    if let email = appState.session?.user.email {
                        Text(email)
                            .font(.system(size: 15))
                            .foregroundStyle(.secondary)
                    }

                    Button("sign out") {
                        appState.signOut()
                        dismiss()
                    }
                    .disabled(isDeleting)

                    Button(isDeleting ? "deleting" : "delete account", role: .destructive) {
                        isConfirmingDelete = true
                    }
                    .disabled(!appState.isSignedIn || isDeleting)

                    if let deleteError {
                        Text(deleteError)
                            .font(.system(size: 13))
                            .foregroundStyle(.red)
                    }
                }

                #if DEBUG
                Section("developer") {
                    Button("backend") {
                        showingBackendSettings = true
                    }
                }
                #endif
            }
            .navigationTitle("settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("done") {
                        dismiss()
                    }
                }
            }
        }
        .confirmationDialog("Delete account?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
            Button("Delete account", role: .destructive) {
                Task {
                    await deleteAccount()
                }
            }
        } message: {
            Text("This removes your Throughline account, memories, recordings, and agent tokens.")
        }
        .sheet(isPresented: $showingBackendSettings) {
            BackendSettingsView()
        }
    }

    private func deleteAccount() async {
        guard appState.isSignedIn else { return }

        isDeleting = true
        defer { isDeleting = false }

        do {
            try await UploadClient().deleteAccount()
            appState.finishAccountDeletion()
            dismiss()
        } catch {
            deleteError = error.localizedDescription
        }
    }
}

struct BackendSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(BackendConfiguration.storageKey) private var backendURL = BackendConfiguration.defaultBaseURLString
    @AppStorage(BackendConfiguration.apiTokenKey) private var backendAPIToken = ""
    @State private var status: BackendStatus = .idle
    @State private var isChecking = false

    var body: some View {
        NavigationStack {
            Form {
                Section("backend") {
                    TextField(BackendConfiguration.defaultBaseURLString, text: $backendURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)

                    SecureField("api token", text: $backendAPIToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    HStack {
                        statusView
                        Spacer()
                        Button(isChecking ? "checking" : "check") {
                            Task {
                                await checkBackend()
                            }
                        }
                        .disabled(isChecking)
                    }

                    Button("use Supabase default") {
                        backendURL = BackendConfiguration.defaultBaseURLString
                        status = .idle
                    }

                    Button("use local backend") {
                        backendURL = BackendConfiguration.localBaseURLString
                        status = .idle
                    }
                }

                Section("agent") {
                    Text("npm run mcp:stdio")
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)
                }
            }
            .navigationTitle("throughline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("done") {
                        dismiss()
                    }
                }
            }
        }
        .task {
            #if !targetEnvironment(simulator)
            backendURL = BackendConfiguration.defaultBaseURLString
            #endif
            await checkBackend()
        }
    }

    private var statusView: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(status.color)
                .frame(width: 8, height: 8)
            Text(status.text)
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
        }
    }

    private func checkBackend() async {
        guard let url = BackendConfiguration.resolvedBaseURL(from: backendURL) else {
            status = .failed("invalid url")
            return
        }

        isChecking = true
        defer { isChecking = false }

        do {
            let token = BackendConfiguration.apiToken(for: url, storedValue: backendAPIToken)
            let health = try await UploadClient(
                baseURL: url,
                apiToken: token
            ).health()
            if health.authRequired == true && health.authenticated != true {
                status = .failed("token required")
            } else {
                status = health.ok ? .ready : .failed("not ready")
            }
        } catch {
            status = .failed("offline")
        }
    }
}

private enum BackendStatus {
    case idle
    case ready
    case failed(String)

    var text: String {
        switch self {
        case .idle: "not checked"
        case .ready: "backend ready"
        case let .failed(message): message
        }
    }

    var color: Color {
        switch self {
        case .idle: .secondary
        case .ready: Theme.blue
        case .failed: .red
        }
    }
}

struct Pill: View {
    let text: String
    var isMood = false

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .regular))
            .padding(.horizontal, 9)
            .padding(.vertical, 6)
            .background(isMood ? Theme.pillBackground : Color.secondary.opacity(0.12))
            .foregroundStyle(isMood ? Theme.pillText : Color.secondary)
            .clipShape(Capsule())
    }
}

struct RecordButton: View {
    var isRecording: Bool
    var isBusy = false
    var size: CGFloat
    let action: () -> Void

    @State private var morphProgress: CGFloat = 0
    @State private var isSpinning = false
    @State private var spinDegrees = 0.0
    @State private var animationGeneration = 0

    private let morphDuration = 0.31
    private let spinDuration = 1.28

    var body: some View {
        Button(action: action) {
            VStack(spacing: 7) {
                ZStack {
                    if isBusy {
                        ProgressView()
                            .tint(.white)
                    } else {
                        ThroughlineRecordMark(
                            morphProgress: morphProgress,
                            isSpinning: isSpinning,
                            spinDegrees: spinDegrees
                        )
                    }
                }
                .frame(width: 132, height: 38)

                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: max(74, size + 18))
            .background(Theme.blue)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .padding(.horizontal, 24)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .onAppear {
            syncAnimation(animated: false)
        }
        .onChange(of: isRecording) { _, _ in
            syncAnimation(animated: true)
        }
        .onChange(of: isBusy) { _, _ in
            syncAnimation(animated: true)
        }
    }

    private var title: String {
        if isBusy {
            return "saving"
        }

        return isRecording ? "stop recording" : "start recording"
    }

    private func syncAnimation(animated: Bool) {
        animationGeneration += 1
        let generation = animationGeneration
        isSpinning = false
        spinDegrees = 0

        if isRecording && !isBusy {
            let animation = Animation.timingCurve(0.2, 0.9, 0.2, 1, duration: animated ? morphDuration : 0)
            withAnimation(animation) {
                morphProgress = 1
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + morphDuration) {
                guard animationGeneration == generation else { return }
                isSpinning = true
                spinDegrees = 0
                withAnimation(.linear(duration: spinDuration).repeatForever(autoreverses: false)) {
                    spinDegrees = 360
                }
            }
        } else {
            let animation = Animation.timingCurve(0.2, 0.9, 0.2, 1, duration: animated ? morphDuration : 0)
            withAnimation(animation) {
                morphProgress = 0
            }
        }
    }
}

private struct ThroughlineRecordMark: View {
    var morphProgress: CGFloat
    var isSpinning: Bool
    var spinDegrees: Double

    var body: some View {
        ZStack {
            ThroughlineRecordMorphShape(side: .left, progress: morphProgress)
                .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                .opacity(isSpinning ? 0 : 1)

            ThroughlineRecordMorphShape(side: .right, progress: morphProgress)
                .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                .opacity(isSpinning ? 0 : 1)

            Circle()
                .trim(from: 0, to: 0.947)
                .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                .frame(width: 35, height: 35)
                .rotationEffect(.degrees(spinDegrees - 90))
                .opacity(isSpinning ? 1 : 0)
        }
    }
}

private struct ThroughlineRecordMorphShape: Shape {
    enum Side {
        case left
        case right
    }

    var side: Side
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let points = stagedPoints(for: side, progress: progress)
        let scale = min(rect.width / 260, rect.height / 92)
        let xOffset = (rect.width - 260 * scale) / 2
        let yOffset = (rect.height - 92 * scale) / 2

        func point(_ index: Int) -> CGPoint {
            CGPoint(
                x: points[index] * scale + xOffset,
                y: points[index + 1] * scale + yOffset
            )
        }

        var path = Path()
        path.move(to: point(0))
        path.addCurve(to: point(6), control1: point(2), control2: point(4))
        path.addCurve(to: point(12), control1: point(8), control2: point(10))
        return path
    }

    private func stagedPoints(for side: Side, progress: CGFloat) -> [CGFloat] {
        let joinProgress: CGFloat = 0.42
        let values = values(for: side)

        if progress <= joinProgress {
            return interpolate(from: values.idle, to: values.joined, progress: progress / joinProgress)
        }

        return interpolate(
            from: values.joined,
            to: values.recording,
            progress: (progress - joinProgress) / (1 - joinProgress)
        )
    }

    private func interpolate(from: [CGFloat], to: [CGFloat], progress: CGFloat) -> [CGFloat] {
        from.enumerated().map { index, point in
            point + (to[index] - point) * progress
        }
    }

    private func values(for side: Side) -> (idle: [CGFloat], joined: [CGFloat], recording: [CGFloat]) {
        switch side {
        case .left:
            (
                idle: [57, 46, 75, 46, 94, 46, 111, 46, 111, 46, 111, 46, 111, 46],
                joined: [57, 46, 78, 46, 109, 46, 149, 46, 149, 46, 149, 46, 149, 46],
                recording: [95, 46, 95, 27, 111, 11, 130, 11, 149, 11, 165, 27, 165, 46]
            )
        case .right:
            (
                idle: [149, 46, 166, 46, 185, 46, 203, 46, 203, 46, 203, 46, 203, 46],
                joined: [149, 46, 168, 46, 187, 46, 203, 46, 203, 46, 203, 46, 203, 46],
                recording: [165, 46, 165, 65, 149, 81, 130, 81, 111, 81, 95, 65, 95, 46]
            )
        }
    }
}
