import CryptoKit
import Foundation
import Security

struct AuthUser: Codable, Equatable, Sendable {
    let id: String
    let email: String?
    let createdAt: String?
    let lastSignInAt: String?

    init(id: String, email: String?, createdAt: String? = nil, lastSignInAt: String? = nil) {
        self.id = id
        self.email = email
        self.createdAt = createdAt
        self.lastSignInAt = lastSignInAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case createdAt = "created_at"
        case lastSignInAt = "last_sign_in_at"
    }

    var inferredAccountState: String {
        guard let createdAt,
              let lastSignInAt,
              let createdDate = Self.date(from: createdAt),
              let lastSignInDate = Self.date(from: lastSignInAt)
        else {
            return "unknown"
        }

        return abs(lastSignInDate.timeIntervalSince(createdDate)) <= 300 ? "new" : "existing"
    }

    private static func date(from value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

struct AuthSession: Codable, Equatable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
    let user: AuthUser

    func needsRefresh(within interval: TimeInterval = 120) -> Bool {
        expiresAt <= Date().addingTimeInterval(interval)
    }
}

enum AuthSessionStore {
    private static let lock = NSRecursiveLock()
    // Every access is serialized by the recursive keychain lock.
    nonisolated(unsafe) private static var revision = UUID()
    static var generation: UUID { lock.lock(); defer { lock.unlock() }; return revision }
    static var snapshot: (session: AuthSession?, generation: UUID) {
        lock.lock(); defer { lock.unlock() }
        let session = currentSession
        return (session, revision)
    }

    private static let legacyStorageKey = "throughline.authSession"
    private static let keychainService = "app.throughline.ios"
    private static let keychainAccount = "authSession"

    static var currentSession: AuthSession? {
        lock.lock(); defer { lock.unlock() }
        if let data = keychainData(), let session = try? JSONDecoder().decode(AuthSession.self, from: data) {
            return session
        }

        guard let legacyData = UserDefaults.standard.data(forKey: legacyStorageKey),
              let legacySession = try? JSONDecoder().decode(AuthSession.self, from: legacyData)
        else {
            return nil
        }

        save(legacySession)
        UserDefaults.standard.removeObject(forKey: legacyStorageKey)
        return legacySession
    }

    static func save(_ session: AuthSession) {
        lock.lock(); defer { lock.unlock() }
        revision = UUID()
        guard let data = try? JSONEncoder().encode(session) else { return }
        saveKeychainData(data)
    }

    static func clear() {
        lock.lock(); defer { lock.unlock() }
        revision = UUID()
        UserDefaults.standard.removeObject(forKey: legacyStorageKey)
        SecItemDelete(baseKeychainQuery() as CFDictionary)
    }

    /// Conditional commit prevents an old refresh from restoring/clearing a newer account.
    static func replace(_ session: AuthSession?, ifGeneration expected: UUID) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard revision == expected else { return false }
        if let session { save(session) } else { clear() }
        return true
    }

    private static func keychainData() -> Data? {
        var query = baseKeychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    private static func saveKeychainData(_ data: Data) {
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemUpdate(baseKeychainQuery() as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess {
            return
        }

        var query = baseKeychainQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    private static func baseKeychainQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount
        ]
    }
}

actor AuthSessionRefresher {
    static let shared = AuthSessionRefresher()
    private var refreshTask: Task<AuthSession?, Error>?
    private var taskGeneration: UUID?

    func validSession() async throws -> AuthSession? {
        let snapshot = AuthSessionStore.snapshot
        guard let session = snapshot.session else { return nil }
        guard session.needsRefresh() else { return session }
        let generation = snapshot.generation
        if let refreshTask, taskGeneration == generation { return try await refreshTask.value }
        let task = Task { () throws -> AuthSession? in
            do {
                let refreshed = try await AuthClient().refreshSession(refreshToken: session.refreshToken)
                guard AuthSessionStore.replace(refreshed, ifGeneration: generation) else { throw CancellationError() }
                return refreshed
            } catch {
                // Offline/timeouts retain sign-in. Only an explicit credential rejection clears it.
                if case let AuthClientError.serverError(status, _) = error, status == 400 || status == 401 {
                    _ = AuthSessionStore.replace(nil, ifGeneration: generation)
                }
                throw error
            }
        }
        refreshTask = task
        taskGeneration = generation
        defer { if taskGeneration == generation { refreshTask = nil; taskGeneration = nil } }
        return try await task.value
    }
}

enum AuthConfiguration {
    static let defaultSupabaseURLString = "https://ywsenspsfyrdhgyxgcrv.supabase.co"

    static var supabaseURL: URL {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "ThroughlineSupabaseURL") as? String,
              let url = URL(string: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.host != nil,
              !rawValue.contains("$(")
        else {
            return URL(string: defaultSupabaseURLString)!
        }

        return url
    }

    static var anonKey: String? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "ThroughlineSupabaseAnonKey") as? String else {
            return nil
        }

        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("$(") else { return nil }
        return trimmed
    }
}

struct AuthClient: Sendable {
    var supabaseURL = AuthConfiguration.supabaseURL
    var anonKey = AuthConfiguration.anonKey

    func signUp(email: String, password: String) async throws -> AuthSession {
        let response: AuthResponse = try await request(
            path: "auth/v1/signup",
            method: "POST",
            body: AuthCredentials(email: email, password: password)
        )
        return try response.session()
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        let response: AuthResponse = try await request(
            path: "auth/v1/token",
            queryItems: [URLQueryItem(name: "grant_type", value: "password")],
            method: "POST",
            body: AuthCredentials(email: email, password: password)
        )
        return try response.session()
    }

    func signInWithIDToken(
        provider: SocialAuthProvider,
        idToken: String,
        nonce: String? = nil,
        accessToken: String? = nil
    ) async throws -> AuthSession {
        let response: AuthResponse = try await request(
            path: "auth/v1/token",
            queryItems: [URLQueryItem(name: "grant_type", value: "id_token")],
            method: "POST",
            body: AuthIDTokenRequest(
                provider: provider.rawValue,
                idToken: idToken,
                nonce: nonce,
                accessToken: accessToken
            )
        )
        return try response.session()
    }

    func providerAvailability() async throws -> AuthProviderAvailability {
        guard let anonKey else {
            throw AuthClientError.missingAnonKey
        }

        var request = URLRequest(url: supabaseURL.appendingPathComponent("auth/v1/settings"))
        request.httpMethod = "GET"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthClientError.invalidResponse
        }
        guard 200..<300 ~= httpResponse.statusCode else {
            throw AuthClientError.serverError(httpResponse.statusCode, Self.errorMessage(from: data))
        }

        let settings = try JSONDecoder().decode(AuthSettingsResponse.self, from: data)
        return AuthProviderAvailability(
            apple: settings.external[SocialAuthProvider.apple.rawValue] == true,
            google: settings.external[SocialAuthProvider.google.rawValue] == true
        )
    }

    func oauthSignInURL(provider: SocialAuthProvider, redirectTo: URL) throws -> URL {
        guard anonKey != nil else {
            throw AuthClientError.missingAnonKey
        }

        var components = URLComponents(
            url: supabaseURL.appendingPathComponent("auth/v1/authorize"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "provider", value: provider.rawValue),
            URLQueryItem(name: "redirect_to", value: redirectTo.absoluteString)
        ]

        guard let url = components.url else {
            throw AuthClientError.invalidResponse
        }
        return url
    }

    func session(fromOAuthCallback callbackURL: URL) async throws -> AuthSession {
        let values = Self.callbackValues(from: callbackURL)
        if let message = values["error_description"] ?? values["error"] {
            throw AuthClientError.serverError(400, message.replacingOccurrences(of: "+", with: " "))
        }

        guard let accessToken = values["access_token"],
              let refreshToken = values["refresh_token"]
        else {
            throw AuthClientError.invalidResponse
        }

        let user = try await currentUser(accessToken: accessToken)
        let expiresIn = TimeInterval(values["expires_in"] ?? "") ?? 3600
        return AuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date().addingTimeInterval(expiresIn),
            user: user
        )
    }

    func resendSignUpConfirmation(email: String) async throws {
        let _: AuthEmptyResponse = try await request(
            path: "auth/v1/resend",
            method: "POST",
            body: AuthResendRequest(type: "signup", email: email)
        )
    }

    func refreshSession(refreshToken: String) async throws -> AuthSession {
        let response: AuthResponse = try await request(
            path: "auth/v1/token",
            queryItems: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            method: "POST",
            body: AuthRefreshRequest(refreshToken: refreshToken)
        )
        return try response.session()
    }

    private func currentUser(accessToken: String) async throws -> AuthUser {
        guard let anonKey else {
            throw AuthClientError.missingAnonKey
        }

        var request = URLRequest(url: supabaseURL.appendingPathComponent("auth/v1/user"))
        request.httpMethod = "GET"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthClientError.invalidResponse
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            throw AuthClientError.serverError(httpResponse.statusCode, Self.errorMessage(from: data))
        }

        return try JSONDecoder().decode(AuthUser.self, from: data)
    }

    private func request<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        queryItems: [URLQueryItem] = [],
        method: String,
        body: RequestBody
    ) async throws -> ResponseBody {
        guard let anonKey else {
            throw AuthClientError.missingAnonKey
        }

        var components = URLComponents(url: supabaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        components.queryItems = queryItems.isEmpty ? nil : queryItems

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthClientError.invalidResponse
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            throw AuthClientError.serverError(httpResponse.statusCode, Self.errorMessage(from: data))
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }

    private static func errorMessage(from data: Data) -> String {
        guard let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return String(data: data, encoding: .utf8) ?? "Unknown auth error"
        }

        return (payload["msg"] as? String)
            ?? (payload["message"] as? String)
            ?? (payload["error_description"] as? String)
            ?? (payload["error"] as? String)
            ?? "Unknown auth error"
    }

    private static func callbackValues(from url: URL) -> [String: String] {
        var values: [String: String] = [:]
        if let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            for item in queryItems {
                if let value = item.value {
                    values[item.name] = value
                }
            }
        }

        if let fragment = url.fragment,
           let fragmentItems = URLComponents(string: "?\(fragment)")?.queryItems {
            for item in fragmentItems {
                if let value = item.value {
                    values[item.name] = value
                }
            }
        }
        return values
    }
}

enum SocialAuthProvider: String, Sendable {
    case apple
    case google
}

struct AuthProviderAvailability: Sendable {
    var apple = false
    var google = false
}

enum AuthNonce {
    static func random(length: Int = 32) throws -> String {
        precondition(length > 0)
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length

        while remaining > 0 {
            var bytes = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            guard status == errSecSuccess else {
                throw AuthClientError.invalidResponse
            }

            for byte in bytes where remaining > 0 {
                if byte < characters.count {
                    result.append(characters[Int(byte)])
                    remaining -= 1
                }
            }
        }

        return result
    }

    static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private struct AuthCredentials: Encodable {
    let email: String
    let password: String
}

private struct AuthRefreshRequest: Encodable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

private struct AuthIDTokenRequest: Encodable {
    let provider: String
    let idToken: String
    let nonce: String?
    let accessToken: String?

    enum CodingKeys: String, CodingKey {
        case provider
        case idToken = "id_token"
        case nonce
        case accessToken = "access_token"
    }
}

private struct AuthSettingsResponse: Decodable {
    let external: [String: Bool]
}

private struct AuthResendRequest: Encodable {
    let type: String
    let email: String
}

private struct AuthEmptyResponse: Decodable {}

private struct AuthResponse: Decodable {
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: TimeInterval?
    let expiresAt: TimeInterval?
    let user: AuthUser?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case user
    }

    func session() throws -> AuthSession {
        guard let accessToken, let refreshToken, let user else {
            throw AuthClientError.emailConfirmationRequired
        }

        let expirationDate: Date
        if let expiresAt {
            expirationDate = Date(timeIntervalSince1970: expiresAt)
        } else if let expiresIn {
            expirationDate = Date().addingTimeInterval(expiresIn)
        } else {
            expirationDate = Date().addingTimeInterval(3600)
        }

        return AuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expirationDate,
            user: user
        )
    }
}

enum AuthClientError: LocalizedError {
    case missingAnonKey
    case invalidResponse
    case emailConfirmationRequired
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .missingAnonKey:
            "Supabase auth is not configured in this build."
        case .invalidResponse:
            "Supabase Auth returned an invalid response."
        case .emailConfirmationRequired:
            "Check your email to confirm your account, then sign in."
        case let .serverError(_, message):
            message
        }
    }
}
