import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var recorder = AudioRecorder()
    @State private var step: Int
    @State private var capturedNote: ThroughlineNote?
    @State private var uploadError: String?
    @State private var showingBackendSettings = false
    @State private var isUploading = false
    @State private var isFinishingRecording = false
    @State private var authEmail = ""
    @State private var authPassword = ""
    @State private var authMode: AuthMode = .createAccount
    @State private var authError: String?
    @State private var authNotice: String?
    @State private var pendingConfirmationEmail: String?
    @State private var isAuthenticating = false
    @State private var isResendingConfirmation = false
    @State private var suppressAuthModeReset = false
    #if DEBUG
    private let debugStep: Int?
    #endif

    init() {
        #if DEBUG
        let debugStep = Self.debugInitialStep
        _step = State(initialValue: debugStep)
        _capturedNote = State(initialValue: debugStep >= 2 ? .sample : nil)
        self.debugStep = debugStep
        #else
        _step = State(initialValue: 0)
        _capturedNote = State(initialValue: nil)
        #endif
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar

            TabView(selection: $step) {
                heroScreen.tag(0)
                recordScreen.tag(1)
                magicScreen.tag(2)
                signInScreen.tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            pageIndicator
        }
        .task {
            await recorder.requestPermissionIfNeeded()
            #if DEBUG
            if let debugStep {
                step = debugStep
            }
            #endif
        }
        .onChange(of: recorder.elapsedSeconds) { _, elapsedSeconds in
            if recorder.isRecording && elapsedSeconds >= 30 {
                stopAndUploadRecording()
            }
        }
        .sheet(isPresented: $showingBackendSettings) {
            BackendSettingsView()
        }
    }

    private var topBar: some View {
        HStack {
            Wordmark()
            Spacer()

            #if DEBUG
            Button("backend") {
                showingBackendSettings = true
            }
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Theme.blue)
            .buttonStyle(.plain)
            #endif
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 8)
    }

    private var pageIndicator: some View {
        HStack(spacing: 10) {
            ForEach(0..<4, id: \.self) { index in
                Capsule()
                    .fill(index == step ? Theme.blue : Color.secondary.opacity(0.32))
                    .frame(width: index == step ? 22 : 7, height: 7)
                    .animation(.easeInOut(duration: 0.2), value: step)
            }
        }
        .frame(height: 24)
        .padding(.bottom, 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Onboarding step \(step + 1) of 4")
    }

    private var heroScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 20) {
                Eyebrow(text: "morning capture")
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("voice")
                    Text("→")
                        .foregroundStyle(Theme.blue)
                    Text("agent")
                }
                .font(.throughlineTitle)
                .lineLimit(3)

                Text("the shortest path from your voice to your AI agent")
                    .font(.system(size: 18))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
            }

            Spacer()

            Text("Throughline is where you speak notes for your AI agent.")
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .lineSpacing(4)
                .padding(.bottom, 22)

            PrimaryButton(title: "try it") {
                step = 1
            }
        }
        .padding(24)
    }

    private var recordScreen: some View {
        VStack(spacing: 28) {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow(text: "demo recording")
                Text("say what's on your mind")
                    .font(.throughlineHeading)
                Text("Speak for up to 30 seconds. Say anything and Throughline will capture it.")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Spacer()

            VStack(spacing: 14) {
                OnboardingRecordButton(phase: recordButtonPhase) {
                    handleRecordTap()
                }
                .disabled(isUploading || isFinishingRecording)

                Text("\(recorder.elapsedText) / 0:30")
                    .font(.system(size: 36, weight: .regular, design: .monospaced))
                    .monospacedDigit()

                Text(recordingStatusText)
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)

                if let uploadError {
                    Text(uploadError)
                        .font(.system(size: 13))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }

            Spacer()
        }
        .padding(24)
    }

    @ViewBuilder
    private var magicScreen: some View {
        if let note = capturedNote {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow(text: "ready")
                    Text("your thoughts became a note")
                        .font(.throughlineHeading)
                }

                Text("\"\(note.transcript)\"")
                    .italic()
                    .font(.system(size: 16))
                    .foregroundStyle(.primary.opacity(0.82))
                    .lineSpacing(5)
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay {
                        RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                            .stroke(Theme.border, lineWidth: 0.5)
                    }

                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 9) {
                        Eyebrow(text: "todos")
                        ForEach(note.todos) { todo in
                            Text(todo.text)
                                .font(.system(size: 15))
                        }
                    }

                    FlowPills(note: note)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay {
                    RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                        .stroke(Theme.border, lineWidth: 0.5)
                }

                Spacer()

                PrimaryButton(title: "continue →") {
                    step = 3
                }
            }
            .padding(24)
        } else {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow(text: "record first")
                    Text("say something to continue")
                        .font(.throughlineHeading)
                }

                Text("Throughline needs a real recording before it can show you the note.")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)

                Spacer()

                PrimaryButton(title: "back to recording") {
                    step = 1
                }
            }
            .padding(24)
        }
    }

    private var signInScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow(text: authMode.eyebrow)
                Text(authMode.heading)
                    .font(.throughlineHeading)
                Text(authSupportingText)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            VStack(spacing: 12) {
                Picker("Account", selection: $authMode) {
                    Text("create").tag(AuthMode.createAccount)
                    Text("sign in").tag(AuthMode.signIn)
                }
                .pickerStyle(.segmented)
                .onChange(of: authMode) { _, _ in
                    if suppressAuthModeReset {
                        suppressAuthModeReset = false
                        return
                    }

                    authError = nil
                    authNotice = nil
                    pendingConfirmationEmail = nil
                    isResendingConfirmation = false
                }

                VStack(spacing: 10) {
                    TextField("email address", text: $authEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .font(.system(size: 16))
                        .padding(.horizontal, 14)
                        .frame(height: 48)
                        .overlay {
                            RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                                .stroke(Theme.border, lineWidth: 0.5)
                        }

                    SecureField("password", text: $authPassword)
                        .textContentType(authMode == .createAccount ? .newPassword : .password)
                        .submitLabel(.go)
                        .onSubmit {
                            if canSubmitAuth {
                                authenticate()
                            }
                        }
                        .font(.system(size: 16))
                        .padding(.horizontal, 14)
                        .frame(height: 48)
                        .overlay {
                            RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                                .stroke(Theme.border, lineWidth: 0.5)
                        }
                }

                if let authNotice {
                    AuthMessage(text: authNotice, tone: .notice)
                }

                if let authError {
                    AuthMessage(text: authError, tone: .error)
                }

                if pendingConfirmationEmail != nil {
                    Button(isResendingConfirmation ? "sending confirmation" : "resend confirmation email") {
                        resendConfirmationEmail()
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.blue)
                    .frame(maxWidth: .infinity)
                    .frame(height: 36)
                    .disabled(isResendingConfirmation)
                }

                PrimaryButton(title: isAuthenticating ? "working" : authMode.primaryTitle) {
                    authenticate()
                }
                .disabled(isAuthenticating || !canSubmitAuth)

                if !canSubmitAuth {
                    Text("Enter both email address and password to continue.")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }

                Button(authMode.switchTitle) {
                    authMode = authMode == .createAccount ? .signIn : .createAccount
                    authError = nil
                    authNotice = nil
                }
                .font(.system(size: 16))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
            }
        }
        .padding(24)
    }

    private func handleRecordTap() {
        if recorder.isRecording {
            stopAndUploadRecording()
        } else {
            do {
                try recorder.start(limitSeconds: nil)
            } catch {
                uploadError = error.localizedDescription
            }
        }
    }

    private var recordingStatusText: String {
        if isUploading {
            return "capturing"
        }

        if isFinishingRecording {
            return "finishing"
        }

        if recorder.isRecording {
            return "tap to stop when you're done"
        }

        return "tap to start"
    }

    private var recordButtonPhase: OnboardingRecordButtonPhase {
        if isUploading {
            return .uploading
        }

        if isFinishingRecording {
            return .stopping
        }

        if recorder.isRecording {
            return .recording
        }

        return .idle
    }

    private var canSubmitAuth: Bool {
        !authEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && authPassword.count >= 6
    }

    private var authSupportingText: String {
        if let pendingConfirmationEmail {
            return "Check \(pendingConfirmationEmail) for the confirmation email. After you confirm it, enter your password here and sign in."
        }

        return authMode.supportingText
    }

    private func stopAndUploadRecording() {
        guard recorder.isRecording, !isUploading, !isFinishingRecording else { return }

        Task {
            do {
                isFinishingRecording = true
                let duration = recorder.elapsedSeconds
                let fileURL = try await recorder.stop()

                try await Task.sleep(for: .milliseconds(520))
                isFinishingRecording = false

                isUploading = true
                defer { isUploading = false }

                let response = try await UploadClient().uploadDemoRecording(
                    fileURL: fileURL,
                    duration: duration,
                    type: .freeform
                )
                capturedNote = response.displayNote
                uploadError = nil
                step = 2
            } catch {
                isFinishingRecording = false
                isUploading = false
                uploadError = error.localizedDescription
            }
        }
    }

    private func finishOnboarding() {
        appState.finishOnboarding(with: capturedNote)
    }

    private func authenticate() {
        guard !isAuthenticating else { return }

        Task {
            isAuthenticating = true
            defer { isAuthenticating = false }

            do {
                let client = AuthClient()
                let email = authEmail.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !email.isEmpty, authPassword.count >= 6 else {
                    authNotice = nil
                    authError = "Enter the email address and password for this account."
                    return
                }

                let session: AuthSession
                if authMode == .createAccount {
                    session = try await client.signUp(email: email, password: authPassword)
                } else {
                    session = try await client.signIn(email: email, password: authPassword)
                }
                appState.setSession(session)
                authError = nil
                authNotice = nil
                pendingConfirmationEmail = nil
                isResendingConfirmation = false
                finishOnboarding()
            } catch {
                handleAuthenticationError(error)
            }
        }
    }

    private func resendConfirmationEmail() {
        guard let email = pendingConfirmationEmail, !isResendingConfirmation else { return }

        Task {
            isResendingConfirmation = true
            defer { isResendingConfirmation = false }

            do {
                try await AuthClient().resendSignUpConfirmation(email: email)
                authError = nil
                authNotice = "We sent another confirmation email to \(email)."
            } catch {
                handleConfirmationResendError(error)
            }
        }
    }

    private func handleConfirmationResendError(_ error: Error) {
        guard let authClientError = error as? AuthClientError else {
            authNotice = nil
            authError = error.localizedDescription
            return
        }

        switch authClientError {
        case let .serverError(_, message):
            let normalized = message.lowercased()
            authNotice = nil
            if normalized.contains("rate") || normalized.contains("too many") {
                authError = "A confirmation email was sent recently. Check your inbox, or try again in a few minutes."
            } else {
                authError = message
            }
        case .missingAnonKey, .invalidResponse, .emailConfirmationRequired:
            authNotice = nil
            authError = authClientError.localizedDescription
        }
    }

    private func handleAuthenticationError(_ error: Error) {
        guard let authClientError = error as? AuthClientError else {
            authNotice = nil
            authError = error.localizedDescription
            return
        }

        switch authClientError {
        case .emailConfirmationRequired:
            let email = authEmail.trimmingCharacters(in: .whitespacesAndNewlines)
            switchToSignInPreservingAuthMessage()
            pendingConfirmationEmail = email.isEmpty ? nil : email
            authPassword = ""
            authError = nil
            authNotice = "We sent a confirmation email. Open it, then return to Throughline and sign in."
        case let .serverError(_, message):
            let normalized = message.lowercased()
            if normalized.contains("email not confirmed") {
                let email = authEmail.trimmingCharacters(in: .whitespacesAndNewlines)
                switchToSignInPreservingAuthMessage()
                pendingConfirmationEmail = email.isEmpty ? pendingConfirmationEmail : email
                authError = nil
                authNotice = "This email still needs confirmation. Open the confirmation email, then return here and sign in."
            } else if normalized.contains("invalid login credentials") {
                authNotice = nil
                pendingConfirmationEmail = nil
                authError = "That email and password did not match. Check both fields, or create a new account."
            } else {
                authNotice = nil
                pendingConfirmationEmail = nil
                authError = message
            }
        case .missingAnonKey, .invalidResponse:
            authNotice = nil
            pendingConfirmationEmail = nil
            authError = authClientError.localizedDescription
        }
    }

    private func switchToSignInPreservingAuthMessage() {
        guard authMode != .signIn else { return }
        suppressAuthModeReset = true
        authMode = .signIn
    }

    #if DEBUG
    private static var debugInitialStep: Int {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "--throughline-onboarding-step"),
              arguments.indices.contains(index + 1),
              let step = Int(arguments[index + 1])
        else {
            return 0
        }

        return min(max(step, 0), 3)
    }
    #endif
}

private enum AuthMode {
    case createAccount
    case signIn

    var eyebrow: String {
        switch self {
        case .createAccount: "create account"
        case .signIn: "welcome back"
        }
    }

    var heading: String {
        switch self {
        case .createAccount: "create your account"
        case .signIn: "sign in"
        }
    }

    var supportingText: String {
        switch self {
        case .createAccount:
            "Create an account to save voice notes and agent-ready memory."
        case .signIn:
            "Use the email and password for your Throughline account."
        }
    }

    var primaryTitle: String {
        switch self {
        case .createAccount: "send confirmation email"
        case .signIn: "sign in"
        }
    }

    var switchTitle: String {
        switch self {
        case .createAccount: "Already have an account? Sign in"
        case .signIn: "Create a new account"
        }
    }
}

private struct AuthMessage: View {
    enum Tone {
        case notice
        case error

        var foreground: Color {
            switch self {
            case .notice: Theme.pillText
            case .error: Color.red
            }
        }

        var background: Color {
            switch self {
            case .notice: Theme.pillBackground
            case .error: Color.red.opacity(0.08)
            }
        }
    }

    let text: String
    let tone: Tone

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .medium))
            .lineSpacing(3)
            .foregroundStyle(tone.foreground)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(tone.background)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct FlowPills: View {
    let note: ThroughlineNote

    var body: some View {
        let pills = note.centersOfBalance + note.tags.prefix(2)

        return VStack(alignment: .leading, spacing: 8) {
            if let mood = note.mood {
                Pill(text: mood.rawValue, isMood: true)
            }

            ForEach(Array(pills), id: \.self) { item in
                Pill(text: item)
            }
        }
    }
}

private enum OnboardingRecordButtonPhase: Equatable {
    case idle
    case recording
    case stopping
    case uploading
}

private struct OnboardingRecordButton: View {
    var phase: OnboardingRecordButtonPhase
    let action: () -> Void

    @State private var morphProgress: CGFloat = 0
    @State private var isSpinning = false
    @State private var spinDegrees = 0.0
    @State private var animationGeneration = 0

    private let morphDuration = 0.31
    private let spinDuration = 1.28

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    if phase == .uploading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        BreathingOrbitMark(
                            morphProgress: morphProgress,
                            isSpinning: isSpinning,
                            spinDegrees: spinDegrees
                        )
                    }
                }
                .frame(width: 144, height: 46)

                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 96)
            .background(Theme.blue)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .onAppear {
            syncAnimation(with: phase, animated: false)
        }
        .onChange(of: phase) { _, newValue in
            syncAnimation(with: newValue, animated: true)
        }
    }

    private var title: String {
        if phase == .uploading {
            return "capturing"
        }

        if phase == .recording || phase == .stopping {
            return "stop recording"
        }

        return "start recording"
    }

    private func syncAnimation(with phase: OnboardingRecordButtonPhase, animated: Bool) {
        animationGeneration += 1
        let generation = animationGeneration
        isSpinning = false
        spinDegrees = 0

        if phase == .recording {
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
        } else if phase == .idle || phase == .stopping {
            let animation = Animation.timingCurve(0.2, 0.9, 0.2, 1, duration: animated ? morphDuration : 0)
            withAnimation(animation) {
                morphProgress = 0
            }
        }
    }
}

private struct BreathingOrbitMark: View {
    var morphProgress: CGFloat
    var isSpinning: Bool
    var spinDegrees: Double

    var body: some View {
        ZStack {
            BreathingOrbitMorphShape(side: .left, progress: morphProgress)
                .stroke(.white, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                .opacity(isSpinning ? 0 : 1)

            BreathingOrbitMorphShape(side: .right, progress: morphProgress)
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

private struct BreathingOrbitMorphShape: Shape {
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
