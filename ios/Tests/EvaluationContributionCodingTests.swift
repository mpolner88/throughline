import Foundation

@main
struct EvaluationContributionCodingTests {
    static func main() throws {
        try defaultRequestEncodesFailClosed()
        try acceptedRequestBindsExactCompletePreview()
        previewRequiresExactlyTheCanonicalContract()
        nestedTodosRemainInspectable()
        readinessDefaultsOffAndCorrectionDoesNotAccept()
        invalidPreviewDisablesAcceptance()
        everyBindingChangeResetsAcceptance()
        try legacyAbsentReadinessNeverDecodesAsTrue()
        EvaluationContributionCopyTests.run()
    }

    private static func defaultRequestEncodesFailClosed() throws {
        let json = try object(JSONEncoder().encode(EvaluationContributionRequest.fixture))
        expect(json["notice_version"] as? String == "private_evaluation_notice_v1", "Notice version must be exact")
        expect(json["disclosure_version"] as? String == "private_evaluation_disclosure_v1", "Disclosure version must be exact")
        expect(json["policy_version"] as? String == "private_evaluation_policy_v1", "Policy version must be exact")
        expect(json["should_remember"] == nil, "Legacy should_remember must never be encoded")
        expect(json["evaluated_revision_id"] as? String == EvaluationContributionRequest.fixture.evaluatedRevisionID.uuidString.lowercased(), "The exact revision must encode lowercase")
        expect(json["agent_ready"] as? Bool == false, "Readiness must default false")
        expect(json["agent_readiness_preview"] is NSNull, "Default readiness must carry no binding")
    }

    private static func acceptedRequestBindsExactCompletePreview() throws {
        let preview = makePreview()
        let accepted = EvaluationContributionRequest.fixture.withPreview(preview).withReadiness(.accepted)
        let json = try object(JSONEncoder().encode(accepted))
        let binding = json["agent_readiness_preview"] as? [String: Any]
        expect(json["agent_ready"] as? Bool == true, "Explicit acceptance must encode true")
        expect(binding?["preview_sha256"] as? String == preview.previewSHA256, "Acceptance must bind the exact preview")
        expect(binding?["revision_id"] as? String == preview.revisionID, "Acceptance must bind the loaded revision")
        expect((binding?["canonical_fields"] as? [[String: Any]])?.count == 14, "Acceptance must bind all fields")
    }

    private static func previewRequiresExactlyTheCanonicalContract() {
        let preview = makePreview()
        expect(preview.isComplete, "Exact 14-field preview must be complete")
        expect(preview.rows.map(\.field) == AgentReadinessPreview.canonicalFieldOrder, "Order must match the frozen contract")
        expect(!makePreview(rows: Array(preview.rows.dropLast())).isComplete, "Missing field must fail closed")
        var extra = preview.rows
        extra.append(.init(field: "hidden_field", value: .string("no")))
        expect(!makePreview(rows: extra).isComplete, "Extra field must fail closed")
        expect(!makePreview(rows: preview.rows.reversed()).isComplete, "Reordered field set must fail closed")
    }

    private static func nestedTodosRemainInspectable() {
        let lines = makePreview().rows.first { $0.field == "todos" }?.inspectableLines ?? []
        expect(lines.contains("[0].text: Call the dentist"), "Nested todo text must be inspectable")
        expect(lines.contains("[0].priority: high"), "Nested todo priority must be inspectable")
        expect(lines.contains("[0].completed: false"), "Nested todo booleans must be inspectable")
    }

    private static func readinessDefaultsOffAndCorrectionDoesNotAccept() {
        var state = EvaluationContributionState()
        expect(state.readinessChoice == .notAccepted, "Readiness must start off")
        state.loadPreview(makePreview())
        state.recordCorrectionSaved()
        expect(state.readinessChoice == .notAccepted, "Correction save must not accept readiness")
        expect(!state.canAcceptReadiness, "Fetched but unseen output must not enable acceptance")
        state.recordPreviewPresented()
        expect(state.canAcceptReadiness, "Complete presented preview may enable explicit acceptance")
        state.acceptReadiness()
        expect(state.readinessChoice == .accepted, "Only explicit acceptance may turn readiness on")
    }

    private static func invalidPreviewDisablesAcceptance() {
        var state = EvaluationContributionState()
        state.loadPreview(makePreview(rows: Array(makePreview().rows.dropLast())))
        expect(!state.canAcceptReadiness, "Incomplete preview must disable acceptance")
        state.acceptReadiness()
        expect(state.readinessChoice == .notAccepted, "Incomplete preview must remain off")
        state.loadPreview(nil)
        expect(!state.canAcceptReadiness && state.boundPreview == nil, "Absent preview must fail closed")
    }

    private static func everyBindingChangeResetsAcceptance() {
        let original = makePreview()
        let changes: [(String, (AgentReadinessPreview) -> AgentReadinessPreview)] = [
            ("payload", { $0.replacing(canonicalPayloadSHA256: hash("b")) }),
            ("output", { $0.replacing(rows: $0.rows.replacingTitle("Changed")) }),
            ("schema", { $0.replacing(productionSchemaSHA256: hash("c")) }),
            ("normalizer", { $0.replacing(productionNormalizerSHA256: hash("d")) }),
            ("keyset", { $0.replacing(canonicalKeysetSHA256: hash("e")) }),
            ("revision", { $0.replacing(revisionID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") })
        ]
        for (label, mutate) in changes {
            var state = EvaluationContributionState()
            state.loadPreview(original)
            state.recordPreviewPresented()
            state.acceptReadiness()
            state.loadPreview(mutate(original))
            expect(state.readinessChoice == .notAccepted, "Changed \(label) must reset readiness")
            expect(state.boundPreview == nil, "Changed \(label) must remove binding")
        }
    }

    private static func legacyAbsentReadinessNeverDecodesAsTrue() throws {
        let legacy = Data(#"{"evaluation_id":"11111111-1111-4111-8111-111111111111","evaluated_revision_id":"22222222-2222-4222-8222-222222222222","idempotency_key":"33333333-3333-4333-8333-333333333333","score":4}"#.utf8)
        let decoded = try JSONDecoder().decode(EvaluationContributionState.LegacyReadiness.self, from: legacy)
        expect(!decoded.agentReady, "Absent legacy readiness must never become true")
    }

    static func makePreview(rows: [CanonicalFieldPreviewRow]? = nil) -> AgentReadinessPreview {
        AgentReadinessPreview(
            previewVersion: "throughline-agent-readiness-preview-v1",
            revisionID: "22222222-2222-4222-8222-222222222222",
            rows: rows ?? canonicalRows,
            canonicalPayloadSHA256: hash("1"),
            productionSchemaSHA256: hash("2"),
            productionNormalizerSHA256: hash("3"),
            canonicalKeysetSHA256: hash("4"),
            previewSHA256: hash("5")
        )
    }

    private static let canonicalRows: [CanonicalFieldPreviewRow] = [
        .init(field: "type", value: .string("freeform")),
        .init(field: "title", value: .string("Plan the week")),
        .init(field: "summary", value: .string("Prepare for the week.")),
        .init(field: "most_important", value: .array([.string("Call the dentist")])),
        .init(field: "todos", value: .array([.object(["text": .string("Call the dentist"), "priority": .string("high"), "completed": .bool(false)])])),
        .init(field: "priorities", value: .array([.string("Health")])),
        .init(field: "intentions", value: .array([.string("Stay calm")])),
        .init(field: "accomplishments", value: .array([])),
        .init(field: "tomorrow_todos", value: .array([.string("Pack lunch")])),
        .init(field: "mood", value: .string("focused")),
        .init(field: "people", value: .array([.string("Sam")])),
        .init(field: "projects", value: .array([.string("Launch")])),
        .init(field: "tags", value: .array([.string("planning")])),
        .init(field: "centers_of_balance", value: .array([.string("health")]))
    ]

    private static func object(_ data: Data) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: data) as! [String: Any]
    }

    private static func hash(_ character: Character) -> String {
        String(repeating: String(character), count: 64)
    }
}

private extension EvaluationContributionRequest {
    static let fixture = EvaluationContributionRequest(
        evaluationID: UUID(uuidString: "11111111-1111-4111-8111-111111111111")!,
        evaluatedRevisionID: UUID(uuidString: "22222222-2222-4222-8222-222222222222")!,
        idempotencyKey: UUID(uuidString: "33333333-3333-4333-8333-333333333333")!,
        score: 4,
        issueCodes: ["weak_summary"]
    )
}

private extension Array where Element == CanonicalFieldPreviewRow {
    func replacingTitle(_ title: String) -> [CanonicalFieldPreviewRow] {
        map { $0.field == "title" ? .init(field: $0.field, value: .string(title)) : $0 }
    }
}

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else {
        FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
        exit(1)
    }
}
