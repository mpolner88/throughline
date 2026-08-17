import AuthenticationServices
import SwiftUI
import UIKit

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var recorder = AudioRecorder()
    @State private var step: Int
    @State private var capturedNote: ThroughlineNote?
    @State private var capturedRecordingDuration = 0
    @State private var uploadError: String?
    @State private var isUploading = false
    @State private var isFinishingRecording = false
    @State private var isPreparingRecording = false
    @State private var isSavingDemoNote = false
    @State private var authEmail = ""
    @State private var authPassword = ""
    @State private var authMode: AuthMode = .createAccount
    @State private var authError: String?
    @State private var authNotice: String?
    @State private var pendingConfirmationEmail: String?
    @State private var isAuthenticating = false
    @State private var isResendingConfirmation = false
    @State private var showingEmailAuth = false
    @State private var appleRawNonce: String?
    @State private var googleAuthSession: ASWebAuthenticationSession?
    @State private var providerAvailability = AuthProviderAvailability()
    #if DEBUG
    private let debugStep: Int?
    #endif

    init() {
        #if DEBUG
        let debugStep = Self.debugInitialStep
        _step = State(initialValue: debugStep)
        _capturedNote = State(initialValue: debugStep >= 2 ? .sample : nil)
        _authMode = State(initialValue: Self.debugInitialAuthMode)
        _showingEmailAuth = State(initialValue: Self.debugShowsEmailAuth)
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
        }
        .task {
            #if DEBUG
            if let debugStep {
                step = debugStep
            }
            #endif
            trackOnboardingStep(step)
        }
        .onChange(of: step) { _, newStep in
            trackOnboardingStep(newStep)
        }
        .onChange(of: recorder.elapsedSeconds) { _, elapsedSeconds in
            if recorder.isRecording && elapsedSeconds >= 30 {
                stopAndUploadRecording()
            }
        }
        .task {
            await loadProviderAvailability()
        }
    }

    private var topBar: some View {
        HStack {
            Wordmark()
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 8)
    }

    private var heroScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 22) {
                Eyebrow(text: "voice notes, structured")
                Text("Say it.\nGet a plan.")
                    .font(.throughlineTitle)

                Text("Turn a daily or weekly voice note into organized to-dos your AI agent can read.")
                    .font(.system(size: 18))
                    .foregroundStyle(.secondary)
                    .lineSpacing(7)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            PrimaryButton(title: "Try a 30-second note") {
                ProductAnalytics.track("onboarding_started")
                step = 1
            }

            Button("Sign in") {
                authMode = .signIn
                showingEmailAuth = false
                step = 3
            }
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(Theme.blue)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .buttonStyle(.plain)
            .accessibilityHint("Skip the demo and sign in to an existing account")
        }
        .padding(24)
    }

    private var recordScreen: some View {
        VStack(spacing: 28) {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow(text: "30-second demo")
                Text("Talk through today\nor the week.")
                    .font(.throughlineHeading)
                Text("Say your priorities, errands, and follow-ups naturally.")
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
                .disabled(isUploading || isFinishingRecording || isPreparingRecording)

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
                    Eyebrow(text: "your plan")
                    Text("Your voice note\nbecame to-dos.")
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
                        Eyebrow(text: "to-do plan")
                        ForEach(note.displayImportantActionItems) { item in
                            HStack(alignment: .firstTextBaseline, spacing: 9) {
                                Image(systemName: "circle")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.blue)
                                Text(item.text)
                                    .font(.system(size: 15))
                            }
                        }
                    }

                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay {
                    RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                        .stroke(Theme.border, lineWidth: 0.5)
                }

                Spacer()

                PrimaryButton(title: "Save these to-do's") {
                    authMode = .createAccount
                    showingEmailAuth = false
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
                let eyebrow = showingEmailAuth ? authMode.eyebrow : authMode.providerEyebrow
                if !eyebrow.isEmpty {
                    Eyebrow(text: eyebrow)
                }
                Text(showingEmailAuth ? authMode.heading : authMode.providerHeading)
                    .font(.throughlineHeading)
                Text(authSupportingText)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            VStack(spacing: 12) {
                if showingEmailAuth {
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

                    Button(authMode.switchTitle) {
                        switchEmailAuthMode()
                    }
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)

                    Button("← other sign-in options") {
                        showingEmailAuth = false
                        authError = nil
                        authNotice = nil
                    }
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                } else {
                    if providerAvailability.google || previewSocialProviders {
                        ConsumerGoogleSignInButton {
                            startGoogleSignIn()
                        }
                        .disabled(isAuthenticating)
                    }

                    if providerAvailability.apple || previewSocialProviders {
                        SignInWithAppleButton(.continue) { request in
                            prepareAppleSignIn(request)
                        } onCompletion: { result in
                            completeAppleSignIn(result)
                        }
                        .signInWithAppleButtonStyle(.black)
                        .frame(height: ProviderButtonMetrics.height)
                        .clipShape(
                            RoundedRectangle(
                                cornerRadius: ProviderButtonMetrics.cornerRadius,
                                style: .continuous
                            )
                        )
                        .disabled(isAuthenticating)
                    }

                    ConsumerEmailSignInButton {
                        showingEmailAuth = true
                        authError = nil
                        authNotice = nil
                    }
                    .disabled(isAuthenticating)

                    if let authError {
                        AuthMessage(text: authError, tone: .error)
                    }

                }

                VStack(spacing: 3) {
                    Text("By continuing you agree to Throughline’s")
                        .foregroundStyle(.secondary)

                    HStack(spacing: 3) {
                        Link("Terms", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                        Text("and")
                            .foregroundStyle(.secondary)
                        Link("Privacy Policy", destination: URL(string: "https://mpolner88.github.io/throughline/privacy/")!)
                    }
                }
                .font(.system(size: 12, weight: .regular))
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .padding(.top, 6)
            }
        }
        .padding(24)
    }

    private func handleRecordTap() {
        if recorder.isRecording {
            stopAndUploadRecording()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        guard !isPreparingRecording, !recorder.isRecording else { return }

        Task {
            isPreparingRecording = true
            defer { isPreparingRecording = false }

            await recorder.requestPermissionIfNeeded()
            do {
                try recorder.start(limitSeconds: nil)
                ProductAnalytics.track("demo_recording_started")
                uploadError = nil
            } catch {
                uploadError = error.localizedDescription
            }
        }
    }

    private var recordingStatusText: String {
        if isPreparingRecording {
            return "requesting microphone access"
        }

        if isUploading {
            return "capturing"
        }

        if isFinishingRecording {
            return "finishing"
        }

        if recorder.isRecording {
            return "Tap again when you’re done"
        }

        return "Tap again when you’re done"
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
            return "Check \(pendingConfirmationEmail), including spam, for the confirmation link. After confirming, return here and sign in."
        }

        if !showingEmailAuth {
            return authMode.providerSupportingText
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
                guard response.processingStatus == "processed", response.hasNote else {
                    throw UploadClientError.processingFailed(response.processingStatus)
                }
                let note = response.displayNote
                guard !note.displayMostImportant.isEmpty || !note.summary.isEmpty else {
                    throw UploadClientError.processingFailed("empty_structure")
                }
                capturedRecordingDuration = duration
                capturedNote = note
                ProductAnalytics.track(
                    "demo_recording_completed",
                    properties: [
                        "processing_status": response.processingStatus,
                        "duration_bucket": recordingDurationBucket(duration),
                        "structured_items": String(note.displayMostImportant.count),
                        "has_note": response.hasNote ? "true" : "false"
                    ]
                )
                uploadError = nil
                step = 2
            } catch {
                isFinishingRecording = false
                isUploading = false
                ProductAnalytics.track(
                    "recording_failed",
                    properties: [
                        "surface": "onboarding",
                        "stage": "demo_upload",
                        "failure_type": recordingFailureType(error)
                    ]
                )
                uploadError = error.localizedDescription
            }
        }
    }

    private func finishOnboarding() {
        guard !isSavingDemoNote else { return }

        Task {
            isSavingDemoNote = true
            defer { isSavingDemoNote = false }

            let noteToSave = await persistDemoNoteIfNeeded()
            appState.finishOnboarding(with: noteToSave)
        }
    }

    private func persistDemoNoteIfNeeded() async -> ThroughlineNote? {
        guard appState.isSignedIn, let capturedNote else { return capturedNote }

        do {
            let response = try await UploadClient().saveDemoNote(
                capturedNote,
                duration: capturedRecordingDuration
            )
            guard response.processingStatus == "processed", response.hasNote else {
                throw UploadClientError.processingFailed(response.processingStatus)
            }

            let savedNote = response.displayNote
            ProductAnalytics.track(
                "recording_uploaded",
                properties: [
                    "surface": "onboarding_promotion",
                    "duration_bucket": recordingDurationBucket(capturedRecordingDuration)
                ]
            )
            ProductAnalytics.track(
                "recording_processed",
                properties: [
                    "surface": "onboarding_promotion",
                    "processing_status": response.processingStatus
                ]
            )
            return savedNote
        } catch {
            ProductAnalytics.track(
                "recording_failed",
                properties: [
                    "surface": "onboarding",
                    "stage": "demo_promotion",
                    "failure_type": recordingFailureType(error)
                ]
            )
            return capturedNote
        }
    }

    private func recordingDurationBucket(_ seconds: Int) -> String {
        switch seconds {
        case ..<5:
            "under_5_seconds"
        case 5..<15:
            "5_to_14_seconds"
        case 15..<60:
            "15_to_59_seconds"
        default:
            "60_seconds_or_more"
        }
    }

    private func recordingFailureType(_ error: Error) -> String {
        guard let uploadError = error as? UploadClientError else {
            return "client_error"
        }

        switch uploadError {
        case .invalidResponse:
            return "invalid_response"
        case let .serverError(status, _):
            return "http_\(status)"
        case let .processingFailed(status):
            return "processing_\(status)"
        }
    }

    private func prepareAppleSignIn(_ request: ASAuthorizationAppleIDRequest) {
        do {
            let nonce = try AuthNonce.random()
            appleRawNonce = nonce
            request.requestedScopes = [.email, .fullName]
            request.nonce = AuthNonce.sha256(nonce)
            authError = nil
            ProductAnalytics.track("auth_started", properties: ["mode": "apple"])
        } catch {
            authError = "Sign in with Apple could not start. Please try again."
        }
    }

    private func loadProviderAvailability() async {
        do {
            providerAvailability = try await AuthClient().providerAvailability()
        } catch {
            providerAvailability = AuthProviderAvailability()
        }
    }

    private var previewSocialProviders: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("--throughline-preview-social-auth")
        #else
        false
        #endif
    }

    private func completeAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        guard !isAuthenticating else { return }

        switch result {
        case let .success(authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let identityToken = credential.identityToken,
                  let token = String(data: identityToken, encoding: .utf8),
                  let nonce = appleRawNonce
            else {
                authError = "Apple did not return the information needed to sign in. Please try again."
                return
            }

            Task {
                isAuthenticating = true
                defer { isAuthenticating = false }
                do {
                    let session = try await AuthClient().signInWithIDToken(
                        provider: .apple,
                        idToken: token,
                        nonce: nonce
                    )
                    completeSocialAuthentication(session, mode: "apple")
                } catch {
                    failSocialAuthentication(error, mode: "apple")
                }
            }

        case let .failure(error):
            if let authorizationError = error as? ASAuthorizationError,
               authorizationError.code == .canceled {
                return
            }
            failSocialAuthentication(error, mode: "apple")
        }
    }

    private func startGoogleSignIn() {
        guard !isAuthenticating else { return }

        do {
            let callbackURL = URL(string: "throughline://auth/callback")!
            let authURL = try AuthClient().oauthSignInURL(provider: .google, redirectTo: callbackURL)
            ProductAnalytics.track("auth_started", properties: ["mode": "google"])
            isAuthenticating = true
            authError = nil

            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: callbackURL.scheme
            ) { callbackURL, error in
                Task { @MainActor in
                    isAuthenticating = false
                    if let webError = error as? ASWebAuthenticationSessionError,
                       webError.code == .canceledLogin {
                        return
                    }

                    guard let callbackURL else {
                        failSocialAuthentication(error ?? AuthClientError.invalidResponse, mode: "google")
                        return
                    }

                    do {
                        let authSession = try await AuthClient().session(fromOAuthCallback: callbackURL)
                        completeSocialAuthentication(authSession, mode: "google")
                    } catch {
                        failSocialAuthentication(error, mode: "google")
                    }
                }
            }
            session.presentationContextProvider = ThroughlineWebAuthenticationPresenter.shared
            session.prefersEphemeralWebBrowserSession = false
            googleAuthSession = session

            if !session.start() {
                isAuthenticating = false
                authError = "Google sign-in could not start. Please try again."
            }
        } catch {
            isAuthenticating = false
            failSocialAuthentication(error, mode: "google")
        }
    }

    private func completeSocialAuthentication(_ session: AuthSession, mode: String) {
        appState.setSession(session)
        authError = nil
        authNotice = nil
        ProductAnalytics.track(
            "auth_succeeded",
            properties: [
                "mode": mode,
                "account_state": session.user.inferredAccountState,
                "onboarding_path": capturedNote == nil ? "direct" : "demo"
            ]
        )
        finishOnboarding()
    }

    private func failSocialAuthentication(_ error: Error, mode: String) {
        ProductAnalytics.track(
            "auth_failed",
            properties: ["mode": mode, "reason": authenticationFailureReason(error)]
        )
        authError = error.localizedDescription
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

                ProductAnalytics.track(
                    "auth_started",
                    properties: ["mode": authMode.analyticsValue]
                )
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
                ProductAnalytics.track(
                    "auth_succeeded",
                    properties: [
                        "mode": authMode.analyticsValue,
                        "account_state": authMode == .createAccount ? "new" : "existing",
                        "onboarding_path": capturedNote == nil ? "direct" : "demo"
                    ]
                )
                finishOnboarding()
            } catch {
                let failureReason = authenticationFailureReason(error)
                if failureReason != "confirmation_required" {
                    ProductAnalytics.track(
                        "auth_failed",
                        properties: [
                            "mode": authMode.analyticsValue,
                            "reason": failureReason
                        ]
                    )
                }
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
            ProductAnalytics.track(
                "auth_confirmation_required",
                properties: ["mode": AuthMode.createAccount.analyticsValue]
            )
            switchToSignInPreservingAuthMessage()
            pendingConfirmationEmail = email.isEmpty ? nil : email
            authPassword = ""
            authError = nil
            authNotice = "We sent a confirmation link. Open it, then return to Throughline and sign in."
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
        authMode = .signIn
    }

    private func switchEmailAuthMode() {
        authMode = authMode == .createAccount ? .signIn : .createAccount
        clearAuthenticationMessages()
    }

    private func clearAuthenticationMessages() {
        authError = nil
        authNotice = nil
        pendingConfirmationEmail = nil
        isResendingConfirmation = false
    }

    private func trackOnboardingStep(_ step: Int) {
        ProductAnalytics.track(
            "onboarding_step_viewed",
            properties: ["step": String(step + 1)]
        )
    }

    private func authenticationFailureReason(_ error: Error) -> String {
        guard let authError = error as? AuthClientError else { return "unknown" }

        switch authError {
        case .emailConfirmationRequired:
            return "confirmation_required"
        case let .serverError(_, message):
            let normalized = message.lowercased()
            if normalized.contains("email not confirmed") { return "confirmation_required" }
            if normalized.contains("invalid login credentials") { return "invalid_credentials" }
            if normalized.contains("rate") || normalized.contains("too many") { return "rate_limited" }
            return "server_error"
        case .missingAnonKey:
            return "configuration"
        case .invalidResponse:
            return "invalid_response"
        }
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

    private static var debugInitialAuthMode: AuthMode {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "--throughline-auth-mode"),
              arguments.indices.contains(index + 1),
              arguments[index + 1] == "sign-in"
        else {
            return .createAccount
        }

        return .signIn
    }

    private static var debugShowsEmailAuth: Bool {
        ProcessInfo.processInfo.arguments.contains("--throughline-preview-email-auth")
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

    var providerEyebrow: String {
        switch self {
        case .createAccount: ""
        case .signIn: "welcome back"
        }
    }

    var providerHeading: String {
        switch self {
        case .createAccount: "Let’s Get Started.\nFor Free."
        case .signIn: "sign in to Throughline"
        }
    }

    var providerSupportingText: String {
        switch self {
        case .createAccount:
            "Create an account to keep your to-dos and make them available to your AI agent."
        case .signIn:
            "Choose how you usually sign in. Your saved notes and tasks will be waiting for you."
        }
    }

    var supportingText: String {
        switch self {
        case .createAccount:
            "Create an account with email to keep this note and everything you capture next."
        case .signIn:
            "Use the email and password for your Throughline account."
        }
    }

    var primaryTitle: String {
        switch self {
        case .createAccount: "create account"
        case .signIn: "sign in"
        }
    }

    var switchTitle: String {
        switch self {
        case .createAccount: "Already have an account? Sign in"
        case .signIn: "Need an account? Create one"
        }
    }

    var analyticsValue: String {
        switch self {
        case .createAccount: "create_account"
        case .signIn: "sign_in"
        }
    }
}

private final class ThroughlineWebAuthenticationPresenter: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = ThroughlineWebAuthenticationPresenter()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
            ?? ASPresentationAnchor()
    }
}

private enum ProviderButtonMetrics {
    static let height: CGFloat = 56
    static let cornerRadius: CGFloat = 14
    static let googleBorder = Color(red: 218 / 255, green: 224 / 255, blue: 232 / 255)
    static let labelColor = Color(red: 15 / 255, green: 27 / 255, blue: 45 / 255)
}

private struct ConsumerGoogleSignInButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image("GoogleG")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 19, height: 19)
                    .accessibilityHidden(true)

                Text("Continue with Google")
                    .font(.custom("GoogleSans-Medium", size: 17))
                    .foregroundStyle(ProviderButtonMetrics.labelColor)
            }
            .modifier(ProviderButtonChrome())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Continue with Google")
    }
}

private struct ConsumerEmailSignInButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("Continue with email")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.blue)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Continue with email")
    }
}

private struct ProviderButtonChrome: ViewModifier {
    @Environment(\.isEnabled) private var isEnabled

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity)
            .frame(height: ProviderButtonMetrics.height)
            .background(.white)
            .overlay {
                RoundedRectangle(
                    cornerRadius: ProviderButtonMetrics.cornerRadius,
                    style: .continuous
                )
                .stroke(ProviderButtonMetrics.googleBorder, lineWidth: 1)
            }
            .clipShape(
                RoundedRectangle(
                    cornerRadius: ProviderButtonMetrics.cornerRadius,
                    style: .continuous
                )
            )
            .opacity(isEnabled ? 1 : 0.55)
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

        return "Start demo recording"
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
