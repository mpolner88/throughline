import Foundation

enum CaptureState: String, Codable {
    case recording, checkingAudio, waiting, uploading, checkingAccount, failed, signInRequired, saved, confirmedUnreadable, finished
}

enum CaptureTerminalIntent: String, Codable {
    case discard, signOut, accountDeletion, ownerDeleted, dismiss
}

struct CaptureReceipt: Codable, Equatable {
    let version: Int
    let ownerID: String
    let captureID: UUID
    let recordingID: String
    let acceptedAt: String
    let audioSHA256: String
    let audioBytes: Int64
    let capturedAt: String

    enum CodingKeys: String, CodingKey {
        case version
        case ownerID = "owner_id", captureID = "capture_id", recordingID = "recording_id"
        case acceptedAt = "accepted_at", audioSHA256 = "audio_sha256", audioBytes = "audio_bytes", capturedAt = "captured_at"
    }

    func validates(_ capture: CaptureRecord) -> Bool {
        version == 1 && ownerID == capture.ownerID && captureID == capture.id && !recordingID.isEmpty
            && audioBytes > 0 && audioBytes == capture.byteLength && audioSHA256 == capture.sha256
            && ISO8601DateFormatter.captureDate(capturedAt) == ISO8601DateFormatter.captureDate(capture.capturedAt)
            && ISO8601DateFormatter.captureDate(capturedAt) != nil && ISO8601DateFormatter.captureDate(acceptedAt) != nil
    }
}

struct CaptureRecord: Codable, Identifiable {
    var id = UUID()
    var fileToken: UUID? = UUID()
    let ownerID: String
    var accountGeneration: UUID
    let createdAt: Date
    let capturedAt: String
    let timezone: String
    let localTime: String
    let type: RecordingType
    var duration = 0
    var byteLength: Int64?
    var sha256: String?
    var state: CaptureState = .recording
    var hasStartedRecording = false
    var stoppedEarly = false
    var hasEverDispatched = false
    var attemptCount = 0
    var receipt: CaptureReceipt?
    var receiptCleanup = false
    var terminalIntent: CaptureTerminalIntent?
    var eventIDs: [String: String] = [:]
    var pollCount = 0

    var isVisible: Bool { terminalIntent == nil && state != .recording && state != .finished }
    var isUnsaved: Bool { terminalIntent == nil && receipt == nil && fileToken != nil && state != .confirmedUnreadable }
    var canUpload: Bool { terminalIntent == nil && receipt == nil && sha256 != nil && byteLength != nil && state != .confirmedUnreadable && state != .recording }
}

struct CaptureDeletionHold: Codable {
    let ownerID: String
    let token: UUID
}

struct CapturePendingEvent: Codable {
    let ownerID: String
    let event: ProductEvent
}

enum CaptureAccountDeletionResult { case deleted, refused, uncertain }

enum CaptureStoreError: LocalizedError, Equatable {
    case unavailable, insufficientSpace, invalidReceipt, missingCapture
    var errorDescription: String? {
        switch self {
        case .insufficientSpace: "Free up storage on this phone, then try again. Your notes are unaffected."
        case .unavailable: "The recording could not be stored safely. Try again in a moment."
        case .invalidReceipt: "The save could not be confirmed. Your recording is still on this phone."
        case .missingCapture: "The recording is no longer available."
        }
    }
}

extension ISO8601DateFormatter {
    static func captureString(_ date: Date, zone: TimeZone = TimeZone(secondsFromGMT: 0)!) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = zone
        return formatter.string(from: date)
    }
    static func captureDate(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }
}
