import Foundation

@main
struct ProductEventAttributionTests {
    static func main() {
        expect(
            ProductEventAttribution.classify(
                isDebugBuild: true,
                storeEvidence: .unavailable
            ) == .debug,
            "Debug builds must classify as debug"
        )
        expect(
            ProductEventAttribution.classify(
                isDebugBuild: false,
                storeEvidence: .verified(environment: "Xcode")
            ) == .debug,
            "Verified StoreKit Xcode transactions must classify as debug"
        )
        expect(
            ProductEventAttribution.classify(
                isDebugBuild: false,
                storeEvidence: .verified(environment: "Sandbox")
            ) == .testflight,
            "Verified StoreKit sandbox transactions must classify as testflight"
        )
        expect(
            ProductEventAttribution.classify(
                isDebugBuild: false,
                storeEvidence: .verified(environment: "Production")
            ) == .appStore,
            "Verified StoreKit production transactions must classify as app_store"
        )

        let unknownEvidence: [ProductEventStoreEvidence] = [
            .unverified,
            .unavailable,
            .failed,
            .verified(environment: "FutureEnvironment")
        ]
        for evidence in unknownEvidence {
            expect(
                ProductEventAttribution.classify(
                    isDebugBuild: false,
                    storeEvidence: evidence
                ) == .unknown,
                "Untrusted or future StoreKit evidence must classify as unknown: \(evidence)"
            )
        }
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
}
