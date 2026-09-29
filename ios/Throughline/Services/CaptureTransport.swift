import Foundation

struct CaptureWireResponse: Decodable {
    let captureOutcome: String
    let captureReceipt: CaptureReceipt?
    let ownerDeleted: OwnerDeleted?
    struct OwnerDeleted: Decodable {
        let ownerID: String
        let captureID: UUID
        let deletedAt: String
        enum CodingKeys: String, CodingKey { case ownerID = "owner_id", captureID = "capture_id", deletedAt = "deleted_at" }
    }
    enum CodingKeys: String, CodingKey { case captureOutcome = "capture_outcome", captureReceipt = "capture_receipt", ownerDeleted = "owner_deleted" }
}

struct CaptureDeletionResponse: Decodable {
    let deletionOutcome: String
    enum CodingKeys: String, CodingKey { case deletionOutcome = "deletion_outcome" }
}

enum CaptureTransportError: Error { case signInRequired, rejected(Int), invalidResponse }

/// Session-only transport. Audio streams from its protected file through the unchanged
/// AIProcessingPermission dispatch boundary; it is never loaded into a second Data buffer.
@MainActor
struct CaptureTransport {
    let client: UploadClient
    init(client: UploadClient = UploadClient()) { self.client = client }

    func upload(_ capture: CaptureRecord, fileURL: URL, beforeDispatch: () throws -> Void) async throws -> CaptureWireResponse {
        var request = try await ownedRequest(path: "recordings", ownerID: capture.ownerID)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        request.setValue(capture.id.uuidString.lowercased(), forHTTPHeaderField: "X-Throughline-Capture-ID")
        request.setValue(capture.sha256, forHTTPHeaderField: "X-Throughline-Audio-SHA256")
        request.setValue(capture.byteLength.map(String.init), forHTTPHeaderField: "X-Throughline-Audio-Bytes")
        request.setValue(capture.byteLength.map(String.init), forHTTPHeaderField: "Content-Length")
        request.setValue(capture.capturedAt, forHTTPHeaderField: "X-Throughline-Captured-At")
        request.setValue(capture.timezone, forHTTPHeaderField: "X-Throughline-Timezone")
        request.setValue(capture.localTime, forHTTPHeaderField: "X-Throughline-User-Local-Time")
        request.setValue(String(capture.duration), forHTTPHeaderField: "X-Throughline-Duration-Seconds")
        request.setValue(capture.type.rawValue, forHTTPHeaderField: "X-Throughline-Recording-Type")
        request.setValue("async", forHTTPHeaderField: "X-Throughline-Processing-Mode")
        guard let stream = InputStream(url: fileURL) else { throw CaptureStoreError.unavailable }
        request.httpBodyStream = stream
        guard AIProcessingPermission.shared.isAllowed else { throw AIProcessingPermissionError.required }
        try Task.checkCancellation()
        try beforeDispatch()
        let (data, response) = try await AIProcessingPermission.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { rejectSession(for: request); throw CaptureTransportError.signInRequired }
        if let decoded = try? JSONDecoder().decode(CaptureWireResponse.self, from: data),
           (200..<300).contains(status) || status == 409 || status == 503 { return decoded }
        throw CaptureTransportError.rejected(status)
    }

    func lookup(_ capture: CaptureRecord) async throws -> CaptureWireResponse {
        let request = try await ownedRequest(path: "captures/" + capture.id.uuidString.lowercased(), ownerID: capture.ownerID)
        let (data, response) = try await URLSession.shared.data(for: request)
        try check(response, request: request)
        return try JSONDecoder().decode(CaptureWireResponse.self, from: data)
    }

    func recording(_ id: String, ownerID: String) async throws -> RecordingPayload {
        let request = try await ownedRequest(path: "recordings/" + id, ownerID: ownerID)
        let (data, response) = try await URLSession.shared.data(for: request)
        try check(response, request: request)
        return try JSONDecoder().decode(RecordingDetailResponse.self, from: data).recording
    }

    func deletion(_ hold: CaptureDeletionHold, dispatch: Bool, beforeDispatch: () throws -> Void = {}) async throws -> CaptureDeletionResponse {
        var request: URLRequest
        if dispatch {
            request = try await ownedRequest(path: "account", ownerID: hold.ownerID)
            request.httpMethod = "DELETE"
        } else {
            // The random hold token remains usable after the auth account is removed.
            request = URLRequest(url: client.baseURL.appendingPathComponent("account/deletion-status"))
        }
        request.setValue(hold.token.uuidString.lowercased(), forHTTPHeaderField: "X-Throughline-Deletion-Token")
        try Task.checkCancellation()
        try beforeDispatch()
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let status = (response as? HTTPURLResponse)?.statusCode,
              (200..<300).contains(status) || status == 409 || status == 503 else { throw CaptureTransportError.invalidResponse }
        return try JSONDecoder().decode(CaptureDeletionResponse.self, from: data)
    }

    private func ownedRequest(path: String, ownerID: String) async throws -> URLRequest {
        guard let session = try await AuthSessionRefresher.shared.validSession(), session.user.id == ownerID else { throw CaptureTransportError.signInRequired }
        try Task.checkCancellation()
        guard AuthSessionStore.currentSession?.user.id == ownerID else { throw CancellationError() }
        var request = URLRequest(url: client.baseURL.appendingPathComponent(path))
        request.setValue("Bearer " + session.accessToken, forHTTPHeaderField: "Authorization")
        return request
    }

    private func rejectSession(for request: URLRequest) {
        let revision = AuthSessionStore.generation
        guard let current = AuthSessionStore.currentSession,
              request.value(forHTTPHeaderField: "Authorization") == "Bearer " + current.accessToken else { return }
        _ = AuthSessionStore.replace(nil, ifGeneration: revision)
    }

    private func check(_ response: URLResponse, request: URLRequest) throws {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { rejectSession(for: request); throw CaptureTransportError.signInRequired }
        guard (200..<300).contains(status) else { throw CaptureTransportError.rejected(status) }
    }
}
