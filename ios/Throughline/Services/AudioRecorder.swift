import AVFoundation
import Foundation

@MainActor
final class AudioRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var elapsedSeconds = 0
    @Published private(set) var permissionGranted = false

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

    func start(limitSeconds: Int?) throws {
        guard !isRecording else { return }
        guard permissionGranted else {
            throw AudioRecorderError.permissionDenied
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)

        let fileURL = FileManager.default.temporaryDirectory
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
        recorder.record()

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

        try AVAudioSession.sharedInstance().setActive(false)
        return activeFileURL
    }

    private func tick() {
        elapsedSeconds += 1

        if let limitSeconds, elapsedSeconds >= limitSeconds {
            recorder?.stop()
            timer?.invalidate()
            timer = nil
            recorder = nil
            isRecording = false
        }
    }
}

enum AudioRecorderError: LocalizedError {
    case permissionDenied
    case noActiveRecording

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            "Microphone permission is required to record a Throughline note."
        case .noActiveRecording:
            "No active recording was found."
        }
    }
}

