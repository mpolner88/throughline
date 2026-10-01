import Foundation

@main
struct CaptureStoreTests {
    @MainActor static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try durableIdentityAndRestart(root.appendingPathComponent("restart"))
        try atomicMilestoneAndReceipt(root.appendingPathComponent("receipt"))
        try terminalFailureAndLateResponse(root.appendingPathComponent("discard"))
        try ownerPartitionAndDeletionHold(root.appendingPathComponent("owners"))
        try preStartFileFailure(root.appendingPathComponent("file-failure"))
        try failedMilestoneCanRecover(root.appendingPathComponent("write-failure"))
        print("CaptureStoreTests: 6 groups passed (restart, receipts/events, terminal failure, owner/deletion hold, pre-start failure, state-write recovery)")
    }

    @MainActor private static func make(_ store: CaptureStore, owner: String = "synthetic-owner") throws -> CaptureRecord {
        try store.create(ownerID: owner, generation: UUID(), type: .freeform)
    }

    @MainActor private static func durableIdentityAndRestart(_ directory: URL) throws {
        let store = try CaptureStore(directory: directory)
        let record = try make(store)
        let url = try store.audioURL(record)
        expect(url.deletingPathExtension().lastPathComponent != record.id.uuidString.lowercased(), "Independent file token")
        expect(FileManager.default.fileExists(atPath: url.path), "File exists before recorder begins")
        let bytes = Data(repeating: 7, count: 140_000) // Synthetic bytes, never user audio.
        try bytes.write(to: url)
        let identity = try CaptureStore.identity(of: url)
        expect(identity.1 == 140_000 && identity.0.count == 64, "Streaming identity covers complete file")
        try store.update(record.id) { record, _ in
            record.sha256 = identity.0; record.byteLength = identity.1
            record.hasEverDispatched = true; record.state = .checkingAccount
        }
        let restored = try CaptureStore(directory: directory)
        expect(restored.document.captures.first?.id == record.id, "Capture identity survives restart")
        expect(restored.document.captures.first?.hasEverDispatched == true, "Unknown result survives restart")
        try expect(try Data(contentsOf: restored.audioURL(record)) == bytes, "Audio survives restart")
    }

    @MainActor private static func atomicMilestoneAndReceipt(_ directory: URL) throws {
        let store = try CaptureStore(directory: directory)
        let capture = try make(store)
        try store.update(capture.id) { record, _ in record.sha256 = String(repeating: "a", count: 64); record.byteLength = 100 }
        let current = store.document.captures[0]
        let receipt = CaptureReceipt(version: 1, ownerID: current.ownerID, captureID: current.id,
            recordingID: "rec_synthetic", acceptedAt: current.capturedAt, audioSHA256: current.sha256!, audioBytes: 100, capturedAt: current.capturedAt)
        expect(receipt.validates(current), "Matching receipt validates")
        var changed = current; changed.byteLength = 101
        expect(!receipt.validates(changed), "Wrong byte count rejected")
        changed = current; changed.id = UUID()
        expect(!receipt.validates(changed), "Wrong capture binding rejected")
        try store.update(capture.id) { record, events in
            record.receipt = receipt; record.receiptCleanup = true; record.state = .saved
            CaptureStore.enqueue("recording_uploaded", record: &record, events: &events, channel: .debug)
        }
        let restored = try CaptureStore(directory: directory)
        expect(restored.document.captures[0].receipt == receipt && restored.document.events.count == 1, "Receipt and event commit together")
        let eventID = restored.document.events[0].event.id
        try restored.update(capture.id) { record, events in CaptureStore.enqueue("recording_uploaded", record: &record, events: &events, channel: .debug) }
        expect(restored.document.events.count == 1 && restored.document.events[0].event.id == eventID, "Crash replay preserves one stable event")
        try restored.cleanup()
        expect(restored.document.captures[0].isVisible && restored.document.captures[0].state == .saved, "Receipt cleanup keeps structuring row")
        expect(restored.document.captures[0].fileToken == nil, "Receipt cleanup removes private file token")
        expect(restored.document.captures[0].terminalIntent == nil, "Receipt cleanup is not terminal")
        let encoded = String(data: try JSONEncoder().encode(restored.document.events[0].event), encoding: .utf8)!
        expect(!encoded.contains(capture.id.uuidString.lowercased()) && !encoded.contains(current.sha256!), "Event excludes capture and digest")
    }

    @MainActor private static func terminalFailureAndLateResponse(_ directory: URL) throws {
        let store = try CaptureStore(directory: directory)
        let capture = try make(store)
        let url = try store.audioURL(capture)
        let failing = try CaptureStore(directory: directory, write: { _, _ in throw CaptureStoreError.unavailable })
        do { try failing.terminal(ids: [capture.id], intent: .discard, channel: .debug); fatalError("Intent must fail closed") } catch {}
        expect(failing.document.captures[0].terminalIntent == nil, "Failed intent leaves row and state")
        expect(FileManager.default.fileExists(atPath: url.path), "Failed intent never deletes file")
        try store.terminal(ids: [capture.id], intent: .discard, channel: .debug)
        let restored = try CaptureStore(directory: directory)
        expect(!restored.document.captures[0].isVisible && !restored.document.captures[0].canUpload, "Terminal is hidden and ineligible after restart")
        do { try restored.update(capture.id) { record, _ in record.state = .saved }; fatalError("Late callback must be refused") } catch {}
        try restored.cleanup()
        expect(restored.document.captures.isEmpty && !FileManager.default.fileExists(atPath: url.path), "Terminal cleanup is retried after restart")
    }

    @MainActor private static func ownerPartitionAndDeletionHold(_ directory: URL) throws {
        let store = try CaptureStore(directory: directory)
        let first = try make(store, owner: "synthetic-first")
        let second = try make(store, owner: "synthetic-second")
        try store.update(first.id) { record, events in CaptureStore.enqueue("capture_kept", record: &record, events: &events, channel: .debug) }
        let hold = CaptureDeletionHold(ownerID: first.ownerID, token: UUID())
        try store.transaction { $0.holds.append(hold) }
        let restored = try CaptureStore(directory: directory)
        expect(restored.document.holds.first?.token == hold.token, "Deletion hold survives request/response crash")
        expect(restored.document.events[0].ownerID == first.ownerID, "Outbox carries original owner privately")
        try restored.terminal(ids: Set(restored.document.captures.filter { $0.ownerID == first.ownerID }.map(\.id)), intent: .signOut, channel: .debug)
        try restored.cleanup()
        expect(restored.document.captures.map(\.id) == [second.id], "Signing out one owner preserves another owner's capture")
    }

    @MainActor private static func preStartFileFailure(_ directory: URL) throws {
        let store = try CaptureStore(directory: directory, createAudio: { _ in throw CaptureStoreError.insufficientSpace })
        do { _ = try make(store); fatalError("File creation should fail") } catch {}
        expect(store.document.captures.isEmpty, "Pre-start creation failure leaves no invisible orphan")
        let restored = try CaptureStore(directory: directory)
        expect(restored.document.captures.isEmpty, "Compensating cleanup survives restart")
    }

    @MainActor private static func failedMilestoneCanRecover(_ directory: URL) throws {
        var fail = false
        let store = try CaptureStore(directory: directory, write: { data, url in
            if fail { throw CaptureStoreError.unavailable }
            try CaptureStore.atomicWrite(data, url)
        })
        let capture = try make(store)
        fail = true
        do {
            try store.update(capture.id) { record, events in
                record.state = .waiting
                CaptureStore.enqueue("capture_kept", record: &record, events: &events, channel: .debug)
            }
            fatalError("State write should fail")
        } catch {}
        expect(store.document.captures[0].state == .recording && store.document.events.isEmpty, "Failed milestone commits neither state nor event")
        fail = false
        try store.update(capture.id) { record, events in
            record.state = .waiting
            CaptureStore.enqueue("capture_kept", record: &record, events: &events, channel: .debug)
        }
        let restored = try CaptureStore(directory: directory)
        expect(restored.document.captures[0].state == .waiting && restored.document.events.count == 1, "Retry after storage recovery commits both")
    }

    private static func expect(_ value: @autoclosure () throws -> Bool, _ message: String) rethrows {
        if try !value() { fatalError(message) }
    }
}
