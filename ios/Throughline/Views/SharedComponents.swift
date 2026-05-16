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

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(Theme.blue)
                .frame(width: size, height: size)
                .overlay {
                    if isBusy {
                        ProgressView()
                            .tint(.white)
                    } else {
                        RoundedRectangle(cornerRadius: size * 0.09, style: .continuous)
                            .fill(.white)
                            .frame(width: size * 0.34, height: size * 0.34)
                    }
                }
                .overlay {
                    if isRecording && !isBusy {
                        Circle()
                            .stroke(Theme.blue.opacity(0.14), lineWidth: 8)
                            .frame(width: size + 16, height: size + 16)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isBusy ? "Saving recording" : isRecording ? "Stop recording" : "Start recording")
    }
}
