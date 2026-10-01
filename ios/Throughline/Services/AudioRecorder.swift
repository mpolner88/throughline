import AVFoundation
import Foundation
import UIKit

@MainActor
final class AudioRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var elapsedSeconds = 0
    @Published private(set) var permissionGranted = false

    var onInterrupted: (() -> Void)?
    var onLimitReached: (() -> Void)?
    private var durableRecording = false

    override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: AVAudioSession.interruptionNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(leavingApp), name: UIApplication.willResignActiveNotification, object: nil)
    }

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var limitSeconds: Int?
    private var activeFileURL: URL?

    var elapsedText: String {
        let minutes = elapsedSeconds / 60
        let seconds = elapsedSeconds % 60
        return "\(minutes):\(String(format: "%02d", seconds))"
    }

    func requestPermissionIfNeeded() async {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            permissionGranted = true
        case .denied:
            permissionGranted = false
        case .undetermined:
            permissionGranted = await AVAudioApplication.requestRecordPermission()
        @unknown default:
            permissionGranted = false
        }
    }

    func start(limitSeconds: Int?, fileURL durableURL: URL? = nil) throws {
        guard !isRecording else { return }
        guard permissionGranted else {
            throw AudioRecorderError.permissionDenied
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)

        let fileURL = durableURL ?? FileManager.default.temporaryDirectory
            .appendingPathComponent("throughline-\(UUID().uuidString)")
            .appendingPathExtension("m4a")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        let recorder = try AVAudioRecorder(url: fileURL, settings: settings)
        recorder.delegate = self
        guard recorder.prepareToRecord() else { throw AudioRecorderError.couldNotStart }
        if durableURL != nil { try CaptureStore.protect(fileURL) }
        guard recorder.record() else { throw AudioRecorderError.couldNotStart }
        durableRecording = durableURL != nil

        self.recorder = recorder
        self.activeFileURL = fileURL
        self.limitSeconds = limitSeconds
        self.elapsedSeconds = 0
        self.isRecording = true

        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.tick()
            }
        }
    }

    func stop() async throws -> URL {
        guard let activeFileURL else {
            throw AudioRecorderError.noActiveRecording
        }

        recorder?.stop()
        timer?.invalidate()
        timer = nil
        recorder = nil
        isRecording = false

        // The file is closed even if releasing the audio session fails.
        try? AVAudioSession.sharedInstance().setActive(false)
        let handle = try FileHandle(forWritingTo: activeFileURL)
        try handle.synchronize()
        try handle.close()
        return activeFileURL
    }

    @objc private func leavingApp() {
        guard durableRecording, isRecording else { return }
        recorder?.stop()
        timer?.invalidate()
        timer = nil
        isRecording = false
        onInterrupted?()
    }

    @objc private func interrupted(_ notification: Notification) {
        guard let value = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              value == AVAudioSession.InterruptionType.began.rawValue else { return }
        leavingApp()
    }

    nonisolated func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        Task { @MainActor in self.leavingApp() }
    }

    private func tick() {
        elapsedSeconds += 1

        if let limitSeconds, elapsedSeconds >= limitSeconds {
            recorder?.stop()
            timer?.invalidate()
            timer = nil
            recorder = nil
            isRecording = false
            if durableRecording { onLimitReached?() }
        }
    }
}

enum AudioRecorderError: LocalizedError {
    case permissionDenied
    case noActiveRecording
    case couldNotStart

    var errorDescription: String? {
        switch self {
        case .couldNotStart:
            "Couldn’t start recording. Tap to try again."
        case .permissionDenied:
            "Microphone permission is required to record a Throughline note."
        case .noActiveRecording:
            "No active recording was found."
        }
    }
}

