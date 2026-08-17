import Foundation

@main
struct ProductEventCodingTests {
    static func main() throws {
        try legacyQueuedEventDecodesWithoutAttribution()
        try schemaV2EventRoundTripsWithTopLevelRecordingReference()
        try durableProcessingOutcomesEncodeTopLevelRecordingReferences()
        try explicitPreDurableFailureMayOmitRecordingReference()
    }

    private static func legacyQueuedEventDecodesWithoutAttribution() throws {
        let legacyJSON = Data(
            """
            {
              "id": "evt_legacy",
              "event_name": "app_opened",
              "session_id": "session_legacy",
              "occurred_at": "2026-08-17T12:00:00.000Z",
              "app_version": "1.0.4",
              "build_number": "2026081602",
              "properties": {"route": "home"}
            }
            """.utf8
        )

        let event = try JSONDecoder().decode(ProductEvent.self, from: legacyJSON)
        expect(event.schemaVersion == nil, "Legacy events must decode without schema_version")
        expect(event.distributionChannel == nil, "Legacy events must decode without distribution_channel")
        expect(event.recordingID == nil, "Legacy events must decode without recording_id")
    }

    private static func schemaV2EventRoundTripsWithTopLevelRecordingReference() throws {
        let original = makeEvent(
            name: "recording_processed",
            channel: .appStore,
            recordingID: "rec_round_trip",
            properties: [
                "surface": "home",
                "processing_status": "processed"
            ]
        )

        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(ProductEvent.self, from: encoded)
        expect(decoded.schemaVersion == 2, "New events must round-trip as schema v2")
        expect(decoded.distributionChannel == .appStore, "Distribution attribution must round-trip")
        expect(decoded.recordingID == "rec_round_trip", "Recording reference must round-trip")
        expect(decoded == original, "The complete schema-v2 event must round-trip")
    }

    private static func durableProcessingOutcomesEncodeTopLevelRecordingReferences() throws {
        for (name, properties) in [
            ("recording_uploaded", ["surface": "home", "duration_bucket": "15_to_59_seconds"]),
            ("recording_processed", ["surface": "home", "processing_status": "processed"]),
            ("recording_failed", ["surface": "home", "stage": "processing"])
        ] {
            var unsafeProperties = properties
            unsafeProperties["recording_id"] = "rec_nested"
            let encoded = try JSONEncoder().encode(
                makeEvent(
                    name: name,
                    channel: .testflight,
                    recordingID: "rec_durable",
                    properties: unsafeProperties
                )
            )
            let object = try jsonObject(encoded)
            let eventProperties = object["properties"] as? [String: Any]

            expect(object["recording_id"] as? String == "rec_durable", "\(name) must carry top-level recording_id")
            expect(eventProperties?["recording_id"] == nil, "\(name) must not place recording_id in properties")
        }
    }

    private static func explicitPreDurableFailureMayOmitRecordingReference() throws {
        let encoded = try JSONEncoder().encode(
            makeEvent(
                name: "recording_failed",
                channel: .unknown,
                recordingID: nil,
                properties: ["surface": "home", "stage": "pre_record"]
            )
        )
        let object = try jsonObject(encoded)
        expect(object["schema_version"] as? Int == 2, "Pre-durable failures must still use schema v2")
        expect(object["recording_id"] == nil, "Explicit pre-durable failures may omit recording_id")
    }

    private static func makeEvent(
        name: String,
        channel: ProductEventDistributionChannel,
        recordingID: String?,
        properties: [String: String]
    ) -> ProductEvent {
        ProductEvent(
            id: "evt_test",
            eventName: name,
            sessionID: "session_test",
            occurredAt: "2026-08-17T12:00:00.000Z",
            appVersion: "1.0.4",
            buildNumber: "2026081602",
            schemaVersion: 2,
            distributionChannel: channel,
            recordingID: recordingID,
            properties: properties
        )
    }

    private static func jsonObject(_ data: Data) throws -> [String: Any] {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CodingTestError.expectedObject
        }
        return object
    }

    private static func expect(
        _ condition: @autoclosure () -> Bool,
        _ message: String
    ) {
        guard condition() else {
            FileHandle.standardError.write(Data("\(message)\n".utf8))
            exit(1)
        }
    }

    private enum CodingTestError: Error {
        case expectedObject
    }
}
