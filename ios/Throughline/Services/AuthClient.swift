import Foundation
import Security

struct AuthUser: Codable, Equatable, Sendable {
    let id: String
    let email: String?
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
    private static let legacyStorageKey = "throughline.authSession"
    private static let keychainService = "app.throughline.ios"
    private static let keychainAccount = "authSession"

    static var currentSession: AuthSession? {
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
        guard let data = try? JSONEncoder().encode(session) else { return }
        saveKeychainData(data)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: legacyStorageKey)
        SecItemDelete(baseKeychainQuery() as CFDictionary)
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

    func validSession() async throws -> AuthSession? {
        guard let session = AuthSessionStore.currentSession else { return nil }
        guard session.needsRefresh() else { return session }

        if let refreshTask {
            return try await refreshTask.value
        }

        let refreshToken = session.refreshToken
        let task = Task { () throws -> AuthSession? in
            let refreshed = try await AuthClient().refreshSession(refreshToken: refreshToken)
            AuthSessionStore.save(refreshed)
            return refreshed
        }

        refreshTask = task
        do {
            let refreshed = try await task.value
            refreshTask = nil
            return refreshed
        } catch {
            refreshTask = nil
            AuthSessionStore.clear()
            throw error
        }
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

    func refreshSession(refreshToken: String) async throws -> AuthSession {
        let response: AuthResponse = try await request(
            path: "auth/v1/token",
            queryItems: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            method: "POST",
            body: AuthRefreshRequest(refreshToken: refreshToken)
        )
        return try response.session()
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
