import AVFoundation
import Foundation
import Network
import UIKit

@MainActor
final class CaptureQueue: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published private(set) var captures: [CaptureRecord] = []
    @Published private(set) var ownerID: String?
    @Published private(set) var signInRequired = false
    @Published private(set) var isOffline = false
    @Published private(set) var deletionPending = false
    @Published private(set) var playingCaptureID: UUID?
    @Published var errorMessage: String?
    @Published private(set) var storageUnavailable = false
    @Published private(set) var insufficientSpace = false
    @Published private(set) var isPreparing = false
    @Published private(set) var isFinishing = false
    let recorder = AudioRecorder()
    var onNote: ((ThroughlineNote) -> Void)?
    var onSignInRequired: (() -> Void)?
    var onAccountDeleted: (() -> Void)?
    var onSessionRefreshed: ((AuthSession) -> Void)?
    private var store: CaptureStore?
    private let transport = CaptureTransport()
    private var generation = UUID()
    private var activeCaptureID: UUID?
    private var work: Task<Void, Never>?
    private var polls: [UUID: Task<Void, Never>] = [:]
    private var eventWork: Task<Void, Never>?
    private var blocked = Set<UUID>()
    private var storagePaused = Set<UUID>()
    private var player: AVAudioPlayer?
    private let monitor = NWPathMonitor()
    private var channel: ProductEventDistributionChannel = .unknown
    private var preview = false
    private var foreground = true

    var visibleCaptures: [CaptureRecord] { captures.filter { $0.ownerID == ownerID && $0.isVisible } }
    var otherOwnerCaptureCount: Int { captures.filter { $0.ownerID != ownerID && $0.isVisible }.count }
    var unsavedCount: Int { captures.filter { $0.ownerID == ownerID && $0.isUnsaved }.count }
    var representedRecordingIDs: Set<String> { Set(visibleCaptures.compactMap { $0.receipt?.recordingID }) }
    var representedCaptureIDs: Set<String> { Set(visibleCaptures.map { $0.id.uuidString.lowercased() }) }

    override init() {
        super.init()
        do {
            store = try CaptureStore()
            try store?.transaction { doc in
                for index in doc.captures.indices where doc.captures[index].terminalIntent == nil {
                    if doc.captures[index].state == .recording {
                        doc.captures[index].state = .checkingAudio
                        doc.captures[index].stoppedEarly = true
                    } else if doc.captures[index].state == .uploading {
                        doc.captures[index].state = .checkingAccount
                    }
                }
            }
            try? store?.cleanup()
            publish()
        } catch { storageUnavailable = true }
        recorder.onInterrupted = { [weak self] in Task { await self?.stopRecording(stoppedEarly: true) } }
        recorder.onLimitReached = { [weak self] in Task { await self?.stopRecording() } }
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self, !self.preview else { return }
                let wasOffline = self.isOffline
                self.isOffline = path.status != .satisfied
                if wasOffline && !self.isOffline { await self.resume() }
            }
        }
        monitor.start(queue: DispatchQueue(label: "app.throughline.capture-connectivity"))
    }

    func configure(session: AuthSession?) {
        let nextOwner = session?.user.id
        if nextOwner != ownerID {
            if activeCaptureID != nil { Task { await self.stopRecording(stoppedEarly: true) } }
            invalidateWork()
            ownerID = nextOwner
            signInRequired = false
            blocked.removeAll()
        } else if session != nil { signInRequired = false }
        publish()
        if session != nil { Task { await resume() } }
    }

    func startRecording(type: RecordingType, limitSeconds: Int?) async {
        guard activeCaptureID == nil, !recorder.isRecording, !isPreparing, !isFinishing, let ownerID else { return }
        guard AIProcessingPermission.shared.isAllowed else { return }
        let epoch = generation
        isPreparing = true
        defer { isPreparing = false }
        errorMessage = nil
        do {
            await recorder.requestPermissionIfNeeded()
            guard generation == epoch, self.ownerID == ownerID, foreground else { return }
            guard AIProcessingPermission.shared.isAllowed else { return }
            guard recorder.permissionGranted else { throw AudioRecorderError.permissionDenied }
            guard let store else { throw CaptureStoreError.unavailable }
            stopPlayback()
            let capture = try store.create(ownerID: ownerID, generation: generation, type: type)
            activeCaptureID = capture.id
            try recorder.start(limitSeconds: limitSeconds, fileURL: store.audioURL(capture))
            storageUnavailable = false
            insufficientSpace = false
            try store.update(capture.id) { record, events in
                record.hasStartedRecording = true
                CaptureStore.enqueue("recording_started", record: &record, events: &events, channel: channel)
            }
            publish()
        } catch {
            insufficientSpace = (error as? CaptureStoreError) == .insufficientSpace
            storageUnavailable = !(error is AudioRecorderError)
            errorMessage = error.localizedDescription
            if !(error is AudioRecorderError) {
                ProductAnalytics.track("capture_storage_unavailable", properties: ["surface": "home", "storage_reason": insufficientSpace ? "insufficient_space" : "other"])
            }
            if activeCaptureID != nil { await stopRecording(stoppedEarly: true) }
        }
    }

    func stopRecording(stoppedEarly: Bool = false) async {
        guard let id = activeCaptureID, !isFinishing else { return }
        isFinishing = true
        defer { isFinishing = false }
        let duration = recorder.elapsedSeconds
        do { _ = try await recorder.stop() } catch { /* Validate the closed file independently. */ }
        activeCaptureID = nil
        do {
            try store?.update(id) { record, _ in
                record.duration = duration
                record.stoppedEarly = record.stoppedEarly || stoppedEarly
                record.state = .checkingAudio
            }
            try validateAudio(id)
        } catch { errorMessage = CaptureStoreError.unavailable.localizedDescription; storagePaused.insert(id) }
        publish()
        schedule()
    }

    func setForeground(_ active: Bool) async {
        foreground = active
        if active { await resume() } else {
            invalidateWork()
            await interruptRecording()
        }
    }

    func interruptRecording() async {
        if activeCaptureID != nil { await stopRecording(stoppedEarly: true) }
        stopPlayback()
    }

    func resume() async {
        guard !preview, foreground, let store else { return }
        storagePaused.removeAll()
        channel = await ProductEventAttribution.currentDistributionChannel()
        try? store.cleanup()
        publish()
        if deletionPending { _ = await resolveAccountDeletion(); return }
        for record in store.document.captures where record.ownerID == ownerID && record.state == .checkingAudio && record.terminalIntent == nil {
            do { try validateAudio(record.id) } catch { storagePaused.insert(record.id) }
        }
        try? store.transaction { doc in
            // Retain content-free receipt/event identities for at most 30 days after capture.
            doc.captures.removeAll { $0.state == .finished && $0.fileToken == nil && $0.createdAt < Date().addingTimeInterval(-30 * 86400) }
            for index in doc.captures.indices where doc.captures[index].ownerID == ownerID && !isBlocked(doc.captures[index].id) {
                if doc.captures[index].state == .failed || (doc.captures[index].state == .signInRequired && !signInRequired) {
                    doc.captures[index].state = doc.captures[index].hasEverDispatched ? .checkingAccount : .waiting
                }
            }
        }
        publish()
        schedule()
        flushEvents()
    }

    func retry(id: UUID) {
        storagePaused.remove(id)
        guard !deletionPending, !signInRequired, !isBlocked(id), let record = capture(id), record.ownerID == ownerID else { return }
        stopPlayback()
        do {
            try store?.update(id) { record, events in
                record.state = record.hasEverDispatched ? .checkingAccount : .waiting
                CaptureStore.enqueue("capture_upload_retried", record: &record, events: &events, channel: channel,
                    properties: ["retry_kind": "manual"], key: "retry-\(record.attemptCount)")
            }
            publish()
            schedule()
        } catch { errorMessage = CaptureStoreError.unavailable.localizedDescription }
    }

    func play(id: UUID) {
        if playingCaptureID == id { stopPlayback(); return }
        guard let record = capture(id), record.ownerID == ownerID, record.state == .failed,
              record.terminalIntent == nil, let store, !recorder.isRecording else { return }
        do {
            stopPlayback()
            try AVAudioSession.sharedInstance().setCategory(.playback)
            try AVAudioSession.sharedInstance().setActive(true)
            let audio = try AVAudioPlayer(contentsOf: store.audioURL(record))
            audio.delegate = self
            guard audio.play() else { throw CaptureStoreError.unavailable }
            player = audio
            playingCaptureID = id
        } catch { errorMessage = "This recording can’t be played right now. It’s still on your phone." }
    }

    func stopPlayback() {
        player?.stop(); player = nil; playingCaptureID = nil
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.stopPlayback() }
    }

    func discard(id: UUID) throws {
        guard let record = capture(id), record.ownerID == ownerID else { return }
        try terminate(ids: [id], intent: record.state == .confirmedUnreadable ? .dismiss : .discard)
    }

    func discardOtherOwners() throws {
        try terminate(ids: Set(captures.filter { $0.ownerID != ownerID }.map(\.id)), intent: .discard, cleanupReason: "other_account")
    }

    func prepareSignOut() throws {
        // Root first stops an active recording before presenting the count/confirmation.
        guard activeCaptureID == nil else { throw CaptureStoreError.unavailable }
        try terminate(ids: Set(captures.filter { $0.ownerID == ownerID }.map(\.id)), intent: .signOut)
        if let ownerID { try store?.transaction { $0.holds.removeAll { $0.ownerID == ownerID } } }
        invalidateWork()
        publish()
    }

    func beginAccountDeletionHold() throws {
        guard let ownerID, let store else { throw CaptureStoreError.unavailable }
        if !store.document.holds.contains(where: { $0.ownerID == ownerID }) {
            try store.transaction { $0.holds.append(CaptureDeletionHold(ownerID: ownerID, token: UUID())) }
        }
        invalidateWork()
        publish()
    }

    func deleteAccount() async -> CaptureAccountDeletionResult {
        do { try beginAccountDeletionHold() }
        catch { errorMessage = "Nothing was deleted. Try again in a moment."; return .refused }
        return await performDeletion(dispatch: true)
    }

    func resolveAccountDeletion() async -> CaptureAccountDeletionResult { await performDeletion(dispatch: false) }

    private func performDeletion(dispatch: Bool) async -> CaptureAccountDeletionResult {
        guard let ownerID, let hold = store?.document.holds.first(where: { $0.ownerID == ownerID }) else { return .uncertain }
        let epoch = generation
        do {
            let result = try await transport.deletion(hold, dispatch: dispatch) {
                guard epoch == self.generation, self.ownerID == ownerID,
                      self.store?.document.holds.contains(where: { $0.ownerID == ownerID && $0.token == hold.token }) == true else { throw CancellationError() }
            }
            guard epoch == generation, self.ownerID == ownerID else { return .uncertain }
            switch result.deletionOutcome {
            case "deleted":
                // A held account may still be recording locally when its deletion is confirmed.
                if activeCaptureID != nil { await stopRecording(stoppedEarly: true) }
                guard epoch == generation, self.ownerID == ownerID else { return .uncertain }
                try terminate(ids: Set(captures.filter { $0.ownerID == ownerID }.map(\.id)), intent: .accountDeletion)
                try store?.transaction { $0.holds.removeAll { $0.ownerID == ownerID }; $0.events.removeAll { $0.ownerID == ownerID } }
                publish()
                onAccountDeleted?()
                return .deleted
            case "refused":
                // A refusal alone is insufficient: independently confirm the surviving sign-in.
                guard let current = try await AuthSessionRefresher.shared.validSession(), current.user.id == ownerID,
                      epoch == generation else { return .uncertain }
                let health = try await UploadClient().health()
                guard health.authenticated == true, epoch == generation, AuthSessionStore.currentSession?.user.id == ownerID else { return .uncertain }
                try store?.transaction { $0.holds.removeAll { $0.ownerID == ownerID } }
                publish(); schedule()
                return .refused
            default: return .uncertain
            }
        } catch { return .uncertain }
    }

    func reconcile(notes: [ThroughlineNote]) async {
        guard !deletionPending else { return }
        // A list binding locates a capture, but only the separately validated receipt permits cleanup.
        let bindings = Set(notes.compactMap(\.captureID).map { $0.lowercased() })
        let epoch = generation
        for record in captures where record.ownerID == ownerID && record.terminalIntent == nil {
            guard bindings.contains(record.id.uuidString.lowercased()) else { continue }
            if record.receipt == nil {
                do {
                    let result = try await transport.lookup(record)
                    guard valid(record.id, epoch: epoch) else { continue }
                    try apply(result, to: record.id)
                } catch { continue }
            }
            if let updated = capture(record.id), updated.receipt != nil,
               let note = notes.first(where: { $0.id == updated.receipt?.recordingID }) {
                try? observe(note: note, id: updated.id, endPolling: updated.pollCount >= 10)
            }
        }
        publish()
    }

    private func terminate(ids: Set<UUID>, intent: CaptureTerminalIntent, cleanupReason: String? = nil) throws {
        guard let store else { throw CaptureStoreError.unavailable }
        do { try store.terminal(ids: ids, intent: intent, channel: channel, cleanupReason: cleanupReason) }
        catch {
            blocked.formUnion(ids)
            invalidateWork()
            errorMessage = "It’s still on your phone. Try again in a moment."
            throw error
        }
        // Durable intent precedes cancellation, hiding the row, and any file removal.
        invalidateWork()
        publish()
        try? store.cleanup()
        publish()
        schedule()
    }

    private func validateAudio(_ id: UUID) throws {
        guard let store, let record = capture(id), record.receipt == nil, record.terminalIntent == nil else { return }
        let url = try store.audioURL(record)
        let identity: (String, Int64)
        do { identity = try CaptureStore.identity(of: url) }
        catch {
            let failure = error as NSError
            if !record.hasStartedRecording && failure.domain == NSCocoaErrorDomain && failure.code == NSFileReadNoSuchFileError {
                try store.update(id) { record, events in
                    record.state = .confirmedUnreadable
                    CaptureStore.enqueue("capture_interrupted", record: &record, events: &events, channel: channel)
                }
            }
            return // Protected/transient read failures never establish damage.
        }
        let audio: AVAudioPlayer
        do { audio = try AVAudioPlayer(contentsOf: url) }
        catch {
            // Bytes were readable; known decoder/container errors confirm this file is unusable.
            let code = (error as NSError).code
            let confirmed = identity.1 == 0 || [Int(kAudioFileInvalidFileError), Int(kAudioFileUnsupportedDataFormatError), Int(kAudioFileUnsupportedFileTypeError)].contains(code)
            if confirmed {
                try store.update(id) { record, events in
                    record.state = .confirmedUnreadable
                    CaptureStore.enqueue("capture_interrupted", record: &record, events: &events, channel: channel)
                }
            }
            return
        }
        guard identity.1 > 0, audio.duration > 0, audio.prepareToPlay() else { return }
        try store.update(id) { record, events in
            record.duration = max(record.duration, Int(audio.duration.rounded(.up)))
            record.sha256 = identity.0
            record.byteLength = identity.1
            record.state = .waiting
            CaptureStore.enqueue("capture_kept", record: &record, events: &events, channel: channel,
                properties: ["completion": record.stoppedEarly ? "stopped_early" : "complete"])
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func schedule() {
        guard foreground, !preview, work == nil, !deletionPending, !signInRequired, !isOffline, ownerID != nil else { return }
        for record in captures where record.ownerID == ownerID && record.receipt != nil && record.state == .saved { startPoll(record) }
        let epoch = generation
        work = Task { [weak self] in
            guard let self else { return }
            defer {
                if self.generation == epoch {
                    self.work = nil
                    if self.captures.contains(where: { $0.ownerID == self.ownerID && $0.canUpload && $0.state == .waiting && !self.isBlocked($0.id) }) { self.schedule() }
                }
            }
            let ids = self.captures.filter { $0.ownerID == self.ownerID && $0.canUpload && $0.state != .failed && !self.isBlocked($0.id) }.sorted { $0.createdAt < $1.createdAt }.map(\.id)
            for id in ids {
                guard self.valid(id, epoch: epoch) else { continue }
                await self.upload(id: id, epoch: epoch)
            }
            self.flushEvents()
        }
    }

    private func upload(id: UUID, epoch: UUID) async {
        for attempt in 0..<4 {
            guard valid(id, epoch: epoch), let current = capture(id), current.canUpload, foreground, !isOffline, !signInRequired else { return }
            if attempt > 0 {
                do { try await Task.sleep(for: .seconds([0, 2, 10, 30][attempt])) } catch { return }
            }
            guard valid(id, epoch: epoch), let record = capture(id), let store else { return }
            do {
                guard AIProcessingPermission.shared.isAllowed else { throw AIProcessingPermissionError.required }
                if record.hasEverDispatched {
                    let result = try await transport.lookup(record)
                    guard valid(id, epoch: epoch) else { return }
                    if result.captureOutcome == "accepted" || result.captureOutcome == "owner_deleted" {
                        try apply(result, to: id); return
                    }
                }
                let result = try await transport.upload(record, fileURL: store.audioURL(record)) {
                    guard self.valid(id, epoch: epoch) else { throw CancellationError() }
                    try store.update(id) { record, events in
                        record.accountGeneration = epoch
                        record.hasEverDispatched = true
                        record.attemptCount += 1
                        record.state = .uploading
                        if attempt > 0 { CaptureStore.enqueue("capture_upload_retried", record: &record, events: &events, channel: channel, properties: ["retry_kind": "auto"], key: "retry-\(record.attemptCount)") }
                    }
                    publish()
                }
                guard valid(id, epoch: epoch) else { return }
                try apply(result, to: id)
                if capture(id)?.receipt != nil || capture(id) == nil { return }
                if result.captureOutcome == "conflict" || result.captureOutcome == "account_deletion_pending" { return }
            } catch {
                guard valid(id, epoch: epoch) else { return }
                if error is CancellationError { return }
                let permissionRefused = error is AIProcessingPermissionError
                let authRejected = Self.isSignInError(error)
                if authRejected { signInRequired = true; onSignInRequired?() }
                do {
                    try store.update(id) { record, events in
                        if permissionRefused && !current.hasEverDispatched { record.hasEverDispatched = false }
                        record.state = authRejected ? .signInRequired : (permissionRefused || attempt == 3 ? .failed : record.hasEverDispatched ? .checkingAccount : .waiting)
                        CaptureStore.enqueue("capture_upload_attempt_failed", record: &record, events: &events, channel: channel,
                            properties: ["reason": authRejected ? "sign_in_required" : permissionRefused ? "not_allowed" : isOffline ? "offline" : "server", "attempt_bucket": record.attemptCount <= 1 ? "first" : record.attemptCount < 4 ? "2_to_3" : "4_or_more"], key: "failure-\(record.attemptCount)")
                        if record.hasEverDispatched { CaptureStore.enqueue("capture_upload_unconfirmed", record: &record, events: &events, channel: channel) }
                    }
                } catch { storagePaused.insert(id) }
                publish()
                if authRejected || permissionRefused || isOffline { return }
            }
        }
        try? store?.update(id) { record, _ in record.state = .failed }
        publish()
    }

    private func apply(_ response: CaptureWireResponse, to id: UUID) throws {
        guard let store, let capture = capture(id), capture.terminalIntent == nil else { return }
        switch response.captureOutcome {
        case "accepted":
            guard let receipt = response.captureReceipt, receipt.validates(capture) else { throw CaptureStoreError.invalidReceipt }
            try store.update(id) { record, events in
                record.receipt = receipt
                record.receiptCleanup = true
                record.state = .saved
                CaptureStore.enqueue("recording_uploaded", record: &record, events: &events, channel: channel,
                    properties: ["duration_bucket": record.duration < 30 ? "under_30s" : record.duration < 120 ? "30s_2m" : "2m_plus"])
            }
            // Cleanup cannot undo the stored receipt; a failed unlink is retried on foreground.
            try? store.cleanup()
            publish()
            if let record = self.capture(id) { onNote?(savedPlaceholder(record)); startPoll(record) }
        case "owner_deleted":
            guard let deleted = response.ownerDeleted, deleted.ownerID == capture.ownerID, deleted.captureID == id,
                  ISO8601DateFormatter.captureDate(deleted.deletedAt) != nil else { throw CaptureStoreError.invalidReceipt }
            try terminate(ids: [id], intent: .ownerDeleted)
        case "conflict", "account_deletion_pending":
            try store.update(id) { record, _ in record.state = .failed }
        default:
            // nothing_held describes current absence only; prior uncertain dispatch remains sticky.
            try store.update(id) { record, _ in record.state = record.hasEverDispatched ? .checkingAccount : .waiting }
        }
        publish()
    }

    private func startPoll(_ record: CaptureRecord) {
        guard polls[record.id] == nil, record.state == .saved, let receipt = record.receipt else { return }
        if record.pollCount >= 10 {
            try? observe(note: savedPlaceholder(record), id: record.id, endPolling: true)
            return
        }
        let remaining = 10 - record.pollCount
        let epoch = generation
        polls[record.id] = Task { [weak self] in
            guard let self else { return }
            defer { if self.generation == epoch { self.polls[record.id] = nil } }
            for index in 0..<remaining {
                guard self.valid(record.id, epoch: epoch), !self.deletionPending else { return }
                do {
                    if index > 0 { try await Task.sleep(for: .seconds(4)) }
                    try self.store?.update(record.id) { record, _ in record.pollCount += 1 }
                    let payload = try await self.transport.recording(receipt.recordingID, ownerID: record.ownerID)
                    guard self.valid(record.id, epoch: epoch) else { return }
                    try self.observe(note: payload.displayNote(), id: record.id, endPolling: index == remaining - 1)
                    if self.capture(record.id)?.state == .finished { return }
                } catch {
                    guard self.valid(record.id, epoch: epoch) else { return }
                    if Self.isSignInError(error) { self.signInRequired = true; self.onSignInRequired?(); return }
                    if index == remaining - 1 {
                        // Poll exhaustion is not a terminal processing failure. A later list refresh observes it.
                        try? self.observe(note: self.savedPlaceholder(record), id: record.id, endPolling: true)
                    }
                }
            }
        }
    }

    private func observe(note: ThroughlineNote, id: UUID, endPolling: Bool) throws {
        guard let record = capture(id), record.receipt?.recordingID == note.id else { return }
        let status = note.processingStatus ?? "uploaded"
        let failed = ["needs_transcript", "needs_extractor", "transcription_failed", "extraction_failed", "processing_failed"].contains(status)
        let terminal = status == "processed" || failed
        try store?.update(id) { record, events in
            if terminal {
                CaptureStore.enqueue(failed ? "recording_failed" : "recording_processed", record: &record, events: &events, channel: channel,
                    properties: ["processing_status": status])
            }
            if terminal || endPolling { record.state = .finished }
        }
        if terminal || endPolling { onNote?(note) }
        publish()
        flushEvents()
    }

    private func flushEvents() {
        guard foreground, eventWork == nil, let ownerID, !deletionPending, !preview, let store else { return }
        let epoch = generation
        eventWork = Task { [weak self] in
            guard let self else { return }
            defer { if self.generation == epoch { self.eventWork = nil } }
            // One event per request ensures a permanent ownership rejection cannot drop good neighbors.
            for pending in store.document.events where pending.ownerID == ownerID {
                guard self.generation == epoch, !self.deletionPending else { return }
                do {
                    try await UploadClient().sendProductEvents([pending.event], ownerID: ownerID)
                } catch let UploadClientError.serverError(status, _) where (400..<500).contains(status) && status != 401 && status != 429 {
                    // Includes permanent 403 recording ownership loss. Retire only this event.
                } catch { return }
                guard self.generation == epoch else { return }
                try? store.transaction { $0.events.removeAll { $0.event.id == pending.event.id } }
            }
        }
    }

    private func savedPlaceholder(_ record: CaptureRecord) -> ThroughlineNote {
        RecordingPayload(id: record.receipt!.recordingID, createdAt: record.capturedAt, type: record.type,
            processingStatus: "uploaded", transcriptRaw: nil, structuredNote: nil,
            currentRevisionID: nil, captureID: record.id.uuidString.lowercased()).displayNote()
    }
    private func isBlocked(_ id: UUID) -> Bool { blocked.contains(id) || storagePaused.contains(id) }
    private func capture(_ id: UUID) -> CaptureRecord? { store?.document.captures.first { $0.id == id } }
    private func valid(_ id: UUID, epoch: UUID) -> Bool {
        guard foreground, generation == epoch, !Task.isCancelled, !deletionPending, !isBlocked(id),
              let record = capture(id) else { return false }
        return record.ownerID == ownerID && record.terminalIntent == nil
    }
    private func invalidateWork() {
        generation = UUID()
        work?.cancel(); work = nil
        eventWork?.cancel(); eventWork = nil
        polls.values.forEach { $0.cancel() }; polls.removeAll()
        stopPlayback()
    }
    private func publish() {
        captures = store?.document.captures.filter { $0.terminalIntent == nil } ?? []
        deletionPending = store?.document.holds.contains { $0.ownerID == ownerID } ?? false
        if let session = AuthSessionStore.currentSession, session.user.id == ownerID { onSessionRefreshed?(session) }
    }
    private static func isSignInError(_ error: Error) -> Bool {
        if case CaptureTransportError.signInRequired = error { return true }
        if case let AuthClientError.serverError(status, _) = error { return status == 400 || status == 401 }
        return false
    }

    #if DEBUG
    func seedPreview(state: CaptureState, count: Int = 1, unknown: Bool = false, offline: Bool = false, held: Bool = false, otherAccount: Bool = false, mixed: Bool = false) {
        preview = true; invalidateWork(); monitor.cancel()
        ownerID = "preview"; isOffline = offline; deletionPending = held; signInRequired = state == .signInRequired
        captures = (0..<count).map { _ in
            var record = CaptureRecord(ownerID: "preview", accountGeneration: generation, createdAt: Date(), capturedAt: ISO8601DateFormatter.captureString(Date()), timezone: "UTC", localTime: "", type: .freeform)
            record.state = state; record.duration = 20; record.hasEverDispatched = unknown
            if otherAccount { return CaptureRecord(ownerID: "other-synthetic-owner", accountGeneration: generation, createdAt: Date(), capturedAt: ISO8601DateFormatter.captureString(Date()), timezone: "UTC", localTime: "", type: .freeform, duration: 20, state: .waiting) }
            return record
        }
        if mixed && captures.count > 1 { captures[0].state = .saved; captures[1].state = .confirmedUnreadable }
    }
    #endif
}
