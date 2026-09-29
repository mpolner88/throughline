import Foundation
import CryptoKit

/// A single atomic document commits capture transitions and their event outbox together.
/// The document contains no audio, transcript, note text or authentication credentials.
@MainActor
final class CaptureStore {
    struct Document: Codable {
        var version = 1
        var captures: [CaptureRecord] = []
        var holds: [CaptureDeletionHold] = []
        var events: [CapturePendingEvent] = []
    }
    private(set) var document: Document
    let directory: URL
    private let manifest: URL
    private let write: (Data, URL) throws -> Void
    private let createAudio: (URL) throws -> Void

    init(directory: URL? = nil, write: @escaping (Data, URL) throws -> Void = CaptureStore.atomicWrite,
         createAudio: @escaping (URL) throws -> Void = { try CaptureStore.atomicWrite(Data(), $0) }) throws {
        self.directory = try directory ?? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("CaptureStore", isDirectory: true)
        self.manifest = self.directory.appendingPathComponent("captures.json")
        self.write = write
        self.createAudio = createAudio
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
        try Self.protect(self.directory)
        if FileManager.default.fileExists(atPath: manifest.path) {
            document = try JSONDecoder().decode(Document.self, from: Data(contentsOf: manifest))
            guard document.version == 1 else { throw CaptureStoreError.unavailable }
        } else { document = Document() }
    }

    nonisolated static func atomicWrite(_ data: Data, _ url: URL) throws {
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: url, options: .atomic)
        #endif
        try protect(url)
        let handle = try FileHandle(forWritingTo: url)
        try handle.synchronize()
        try handle.close()
    }

    nonisolated static func protect(_ url: URL) throws {
        var url = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try url.setResourceValues(values)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
        #endif
    }

    func transaction(_ change: (inout Document) throws -> Void) throws {
        var candidate = document
        try change(&candidate)
        try write(JSONEncoder().encode(candidate), manifest)
        document = candidate
    }

    func update(_ id: UUID, _ change: (inout CaptureRecord, inout [CapturePendingEvent]) throws -> Void) throws {
        try transaction { candidate in
            guard let index = candidate.captures.firstIndex(where: { $0.id == id }), candidate.captures[index].terminalIntent == nil else { throw CaptureStoreError.missingCapture }
            var record = candidate.captures[index]
            try change(&record, &candidate.events)
            candidate.captures[index] = record
        }
    }

    func create(ownerID: String, generation: UUID, type: RecordingType, now: Date = Date()) throws -> CaptureRecord {
        // 32 MB comfortably holds the unchanged five-minute mono AAC limit plus metadata.
        let values = try directory.resourceValues(forKeys: [.volumeAvailableCapacityKey])
        if let available = values.volumeAvailableCapacity, available < 32 * 1024 * 1024 { throw CaptureStoreError.insufficientSpace }
        let record = CaptureRecord(ownerID: ownerID, accountGeneration: generation, createdAt: now,
            capturedAt: ISO8601DateFormatter.captureString(now), timezone: TimeZone.current.identifier,
            localTime: ISO8601DateFormatter.captureString(now, zone: .current), type: type)
        // Store the mapping first. A crash at either step recovers as a stopped capture.
        try transaction { $0.captures.append(record) }
        let url = try audioURL(record)
        do { try createAudio(url) }
        catch {
            // The recorder has not been created. Persist cleanup intent before touching the file.
            try? transaction { doc in
                if let index = doc.captures.firstIndex(where: { $0.id == record.id }) { doc.captures[index].terminalIntent = .dismiss }
            }
            try? cleanup()
            throw error
        }
        return record
    }

    func audioURL(_ capture: CaptureRecord) throws -> URL {
        guard let token = capture.fileToken else { throw CaptureStoreError.missingCapture }
        return directory.appendingPathComponent(token.uuidString.lowercased()).appendingPathExtension("m4a")
    }

    static func identity(of url: URL) throws -> (String, Int64) {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        var digest = SHA256()
        var count: Int64 = 0
        while let bytes = try file.read(upToCount: 64 * 1024), !bytes.isEmpty {
            digest.update(data: bytes)
            count += Int64(bytes.count)
        }
        return (digest.finalize().map { String(format: "%02x", $0) }.joined(), count)
    }

    func terminal(ids: Set<UUID>, intent: CaptureTerminalIntent, channel: ProductEventDistributionChannel, cleanupReason: String? = nil) throws {
        try transaction { candidate in
            let affected = candidate.captures.filter { ids.contains($0.id) && $0.terminalIntent == nil }
            let ownerCounts = Dictionary(grouping: affected, by: \.ownerID).mapValues(\.count)
            var measuredOwners = Set<String>()
            for index in candidate.captures.indices where ids.contains(candidate.captures[index].id) {
                var record = candidate.captures[index]
                guard record.terminalIntent == nil else { continue }
                record.terminalIntent = intent
                if let reason = cleanupReason ?? (intent == .signOut ? "sign_out" : nil), !measuredOwners.contains(record.ownerID) {
                    let count = ownerCounts[record.ownerID] ?? 0
                    Self.enqueue("capture_account_cleanup", record: &record, events: &candidate.events, channel: channel,
                        properties: ["cleanup_reason": reason, "count_bucket": count == 1 ? "one" : count <= 5 ? "2_to_5" : "6_or_more"])
                    measuredOwners.insert(record.ownerID)
                }
                if intent == .discard {
                    Self.enqueue("capture_discarded", record: &record, events: &candidate.events, channel: channel,
                        properties: ["send_history": record.hasEverDispatched ? "result_unknown" : "never_sent"])
                }
                candidate.captures[index] = record
            }
        }
    }

    /// Invoked only after invalidating work. Removal failure preserves its durable intent for retry.
    func cleanup() throws {
        for record in document.captures where record.terminalIntent != nil || record.receiptCleanup {
            if let _ = record.fileToken {
                let url = try audioURL(record)
                if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
            }
            try transaction { candidate in
                guard let index = candidate.captures.firstIndex(where: { $0.id == record.id }) else { return }
                if record.terminalIntent != nil { candidate.captures.remove(at: index) }
                else { candidate.captures[index].fileToken = nil }
            }
        }
    }

    static func enqueue(_ name: String, record: inout CaptureRecord, events: inout [CapturePendingEvent], channel: ProductEventDistributionChannel, properties: [String: String] = [:], key: String? = nil) {
        let key = key ?? name
        guard record.eventIDs[key] == nil else { return }
        let id = "evt_" + UUID().uuidString.lowercased()
        record.eventIDs[key] = id
        let event = ProductEvent(id: id, eventName: name, sessionID: CaptureEventSession.id,
            occurredAt: ISO8601DateFormatter.captureString(Date()),
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            buildNumber: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String,
            distributionChannel: channel, recordingID: name.hasPrefix("recording_") ? record.receipt?.recordingID : nil,
            properties: properties.merging(["surface": "home"]) { old, _ in old })
        events.append(CapturePendingEvent(ownerID: record.ownerID, event: event))
    }
}

private enum CaptureEventSession { static let id = UUID().uuidString.lowercased() }
