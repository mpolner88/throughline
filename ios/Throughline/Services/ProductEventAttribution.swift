import Foundation
import StoreKit

enum ProductEventDistributionChannel: String, Codable, Equatable, Sendable {
    case debug
    case testflight
    case appStore = "app_store"
    case unknown
}

enum ProductEventStoreEvidence: Equatable, Sendable {
    case verified(environment: String)
    case unverified
    case unavailable
    case failed
}

enum ProductEventAttribution {
    static func classify(
        isDebugBuild: Bool,
        storeEvidence: ProductEventStoreEvidence
    ) -> ProductEventDistributionChannel {
        if isDebugBuild {
            return .debug
        }

        guard case let .verified(environment) = storeEvidence else {
            return .unknown
        }

        switch environment {
        case AppStore.Environment.xcode.rawValue:
            return .debug
        case AppStore.Environment.sandbox.rawValue:
            return .testflight
        case AppStore.Environment.production.rawValue:
            return .appStore
        default:
            return .unknown
        }
    }

    static func currentDistributionChannel() async -> ProductEventDistributionChannel {
        #if DEBUG || targetEnvironment(simulator)
        return classify(isDebugBuild: true, storeEvidence: .unavailable)
        #else
        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *) else {
            return classify(isDebugBuild: false, storeEvidence: .unavailable)
        }

        do {
            switch try await AppTransaction.shared {
            case let .verified(transaction):
                return classify(
                    isDebugBuild: false,
                    storeEvidence: .verified(environment: transaction.environment.rawValue)
                )
            case .unverified:
                return classify(isDebugBuild: false, storeEvidence: .unverified)
            }
        } catch {
            return classify(isDebugBuild: false, storeEvidence: .failed)
        }
        #endif
    }
}

struct ProductEvent: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let eventName: String
    let sessionID: String
    let occurredAt: String
    let appVersion: String?
    let buildNumber: String?
    let schemaVersion: Int?
    let distributionChannel: ProductEventDistributionChannel?
    let recordingID: String?
    let properties: [String: String]

    init(
        id: String,
        eventName: String,
        sessionID: String,
        occurredAt: String,
        appVersion: String?,
        buildNumber: String?,
        schemaVersion: Int? = 2,
        distributionChannel: ProductEventDistributionChannel?,
        recordingID: String?,
        properties: [String: String]
    ) {
        self.id = id
        self.eventName = eventName
        self.sessionID = sessionID
        self.occurredAt = occurredAt
        self.appVersion = appVersion
        self.buildNumber = buildNumber
        self.schemaVersion = schemaVersion
        self.distributionChannel = distributionChannel
        self.recordingID = recordingID
        self.properties = properties.filter { $0.key != "recording_id" }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case eventName = "event_name"
        case sessionID = "session_id"
        case occurredAt = "occurred_at"
        case appVersion = "app_version"
        case buildNumber = "build_number"
        case schemaVersion = "schema_version"
        case distributionChannel = "distribution_channel"
        case recordingID = "recording_id"
        case properties
    }
}
