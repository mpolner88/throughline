import Foundation

enum EvaluationContributionCopy {
    static let disclosure = "Private quality check. Saving this grade or a content correction may keep this recording’s audio past 30 days until you remove the contribution. Not used to train models. Learn more."
    static let privacyLinkLabel = "How we treat recordings"
    static let previewTitle = "What your agent will read"
    static let previewMeaning = "Review every field from this exact note revision before deciding whether it is ready for your agent."
    static let readinessLabel = "Ready for my agent"
    static let readinessMeaning = "Off by default. Turn this on only if all 14 fields shown above are ready for your agent."
    static let removalLabel = "Remove private quality contribution"
    static let removalMeaning = "Stops private quality use and extended audio retention. This does not undo your visible note correction."
    static let explanationPrivacy = "Optional explanation. Kept separate and excluded from private evaluation, scoring, and automated changes."
}

enum EvaluationRatingMode: Equatable {
    case standard
    case privateLineage

    static func resolve(currentRevisionID: String?) -> Self {
        guard let currentRevisionID, UUID(uuidString: currentRevisionID) != nil else {
            return .standard
        }
        return .privateLineage
    }
}

indirect enum CanonicalJSONValue: Codable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([CanonicalJSONValue])
    case object([String: CanonicalJSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([CanonicalJSONValue].self) { self = .array(value) }
        else if let value = try? container.decode([String: CanonicalJSONValue].self) { self = .object(value) }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported canonical preview value") }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case let .bool(value): try container.encode(value)
        case let .number(value): try container.encode(value)
        case let .string(value): try container.encode(value)
        case let .array(value): try container.encode(value)
        case let .object(value): try container.encode(value)
        }
    }

    fileprivate func inspectableLines(prefix: String = "") -> [String] {
        switch self {
        case .null: return ["\(prefix): null"]
        case let .bool(value): return ["\(prefix): \(value ? "true" : "false")"]
        case let .number(value):
            let rendered = value.rounded() == value ? String(Int(value)) : String(value)
            return ["\(prefix): \(rendered)"]
        case let .string(value): return ["\(prefix): \(value)"]
        case let .array(values):
            if values.isEmpty { return ["[]"] }
            return values.enumerated().flatMap { index, value in
                value.inspectableLines(prefix: "\(prefix)[\(index)]")
            }
        case let .object(values):
            if values.isEmpty { return ["{}"] }
            return values.keys.sorted().flatMap { key in
                values[key]!.inspectableLines(prefix: prefix.isEmpty ? key : "\(prefix).\(key)")
            }
        }
    }
}

struct CanonicalFieldPreviewRow: Codable, Equatable, Identifiable {
    let field: String
    let value: CanonicalJSONValue
    var id: String { field }
    var inspectableLines: [String] { value.inspectableLines() }
}

struct AgentReadinessPreview: Codable, Equatable {
    static let canonicalFieldOrder = [
        "type", "title", "summary", "most_important", "todos", "priorities", "intentions",
        "accomplishments", "tomorrow_todos", "mood", "people", "projects", "tags", "centers_of_balance"
    ]

    let previewVersion: String
    let revisionID: String
    let rows: [CanonicalFieldPreviewRow]
    let canonicalPayloadSHA256: String
    let productionSchemaSHA256: String
    let productionNormalizerSHA256: String
    let canonicalKeysetSHA256: String
    let previewSHA256: String

    enum CodingKeys: String, CodingKey {
        case previewVersion = "preview_version"
        case revisionID = "revision_id"
        case rows = "canonical_fields"
        case canonicalPayloadSHA256 = "canonical_payload_sha256"
        case productionSchemaSHA256 = "production_schema_sha256"
        case productionNormalizerSHA256 = "production_normalizer_sha256"
        case canonicalKeysetSHA256 = "canonical_keyset_sha256"
        case previewSHA256 = "preview_sha256"
    }

    var isComplete: Bool {
        previewVersion == "throughline-agent-readiness-preview-v1"
            && UUID(uuidString: revisionID) != nil
            && rows.map(\.field) == Self.canonicalFieldOrder
            && [canonicalPayloadSHA256, productionSchemaSHA256, productionNormalizerSHA256, canonicalKeysetSHA256, previewSHA256].allSatisfy(Self.isSHA256)
    }

    func replacing(
        revisionID: String? = nil,
        rows: [CanonicalFieldPreviewRow]? = nil,
        canonicalPayloadSHA256: String? = nil,
        productionSchemaSHA256: String? = nil,
        productionNormalizerSHA256: String? = nil,
        canonicalKeysetSHA256: String? = nil,
        previewSHA256: String? = nil
    ) -> AgentReadinessPreview {
        .init(
            previewVersion: previewVersion,
            revisionID: revisionID ?? self.revisionID,
            rows: rows ?? self.rows,
            canonicalPayloadSHA256: canonicalPayloadSHA256 ?? self.canonicalPayloadSHA256,
            productionSchemaSHA256: productionSchemaSHA256 ?? self.productionSchemaSHA256,
            productionNormalizerSHA256: productionNormalizerSHA256 ?? self.productionNormalizerSHA256,
            canonicalKeysetSHA256: canonicalKeysetSHA256 ?? self.canonicalKeysetSHA256,
            previewSHA256: previewSHA256 ?? self.previewSHA256
        )
    }

    private static func isSHA256(_ value: String) -> Bool {
        value.count == 64 && value.allSatisfy { $0.isHexDigit && !$0.isUppercase }
    }
}

enum AgentReadinessChoice: Equatable {
    case notAccepted
    case accepted
}

struct EvaluationContributionRequest: Encodable {
    static let noticeVersion = "private_evaluation_notice_v1"
    static let disclosureVersion = "private_evaluation_disclosure_v1"
    static let policyVersion = "private_evaluation_policy_v1"

    let evaluationID: UUID
    let evaluatedRevisionID: UUID
    let idempotencyKey: UUID
    let rubricVersion: String
    let score: Int
    let issueCodes: [String]
    let explanation: String?
    private let readinessChoice: AgentReadinessChoice
    private let preview: AgentReadinessPreview?

    init(
        evaluationID: UUID = UUID(),
        evaluatedRevisionID: UUID,
        idempotencyKey: UUID = UUID(),
        rubricVersion: String = "throughline_extraction_quality_v1",
        score: Int,
        issueCodes: [String] = [],
        explanation: String? = nil,
        readinessChoice: AgentReadinessChoice = .notAccepted,
        preview: AgentReadinessPreview? = nil
    ) {
        self.evaluationID = evaluationID
        self.evaluatedRevisionID = evaluatedRevisionID
        self.idempotencyKey = idempotencyKey
        self.rubricVersion = rubricVersion
        self.score = score
        self.issueCodes = issueCodes
        self.explanation = explanation
        self.readinessChoice = readinessChoice
        self.preview = preview
    }

    func withPreview(_ preview: AgentReadinessPreview?) -> Self {
        .init(evaluationID: evaluationID, evaluatedRevisionID: evaluatedRevisionID, idempotencyKey: idempotencyKey, rubricVersion: rubricVersion, score: score, issueCodes: issueCodes, explanation: explanation, readinessChoice: readinessChoice, preview: preview)
    }

    func withReadiness(_ choice: AgentReadinessChoice) -> Self {
        .init(evaluationID: evaluationID, evaluatedRevisionID: evaluatedRevisionID, idempotencyKey: idempotencyKey, rubricVersion: rubricVersion, score: score, issueCodes: issueCodes, explanation: explanation, readinessChoice: choice, preview: preview)
    }

    private var acceptedPreview: AgentReadinessPreview? {
        guard readinessChoice == .accepted, let preview, preview.isComplete,
              preview.revisionID.lowercased() == evaluatedRevisionID.uuidString.lowercased()
        else { return nil }
        return preview
    }

    enum CodingKeys: String, CodingKey {
        case evaluationID = "evaluation_id"
        case evaluatedRevisionID = "evaluated_revision_id"
        case idempotencyKey = "idempotency_key"
        case rubricVersion = "rubric_version"
        case noticeVersion = "notice_version"
        case disclosureVersion = "disclosure_version"
        case policyVersion = "policy_version"
        case score
        case issueCodes = "issue_codes"
        case agentReady = "agent_ready"
        case agentReadinessPreview = "agent_readiness_preview"
        case explanation
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(evaluationID.uuidString.lowercased(), forKey: .evaluationID)
        try container.encode(evaluatedRevisionID.uuidString.lowercased(), forKey: .evaluatedRevisionID)
        try container.encode(idempotencyKey.uuidString.lowercased(), forKey: .idempotencyKey)
        try container.encode(rubricVersion, forKey: .rubricVersion)
        try container.encode(Self.noticeVersion, forKey: .noticeVersion)
        try container.encode(Self.disclosureVersion, forKey: .disclosureVersion)
        try container.encode(Self.policyVersion, forKey: .policyVersion)
        try container.encode(score, forKey: .score)
        try container.encode(issueCodes, forKey: .issueCodes)
        try container.encode(acceptedPreview != nil, forKey: .agentReady)
        if let acceptedPreview { try container.encode(acceptedPreview, forKey: .agentReadinessPreview) }
        else { try container.encodeNil(forKey: .agentReadinessPreview) }
        try container.encodeIfPresent(explanation, forKey: .explanation)
    }
}

struct EvaluationContributionState {
    struct LegacyReadiness: Decodable {
        let agentReady: Bool
        enum CodingKeys: String, CodingKey { case agentReady = "agent_ready" }
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            agentReady = try container.decodeIfPresent(Bool.self, forKey: .agentReady) ?? false
        }
    }

    private(set) var readinessChoice: AgentReadinessChoice = .notAccepted
    private(set) var currentPreview: AgentReadinessPreview?
    private(set) var boundPreview: AgentReadinessPreview?
    private(set) var hasSavedContribution = false
    private(set) var hasPresentedCompletePreview = false

    var canAcceptReadiness: Bool { currentPreview?.isComplete == true && hasPresentedCompletePreview }

    mutating func loadPreview(_ preview: AgentReadinessPreview?) {
        guard let preview, preview.isComplete else {
            currentPreview = nil
            resetReadiness()
            return
        }
        if currentPreview != preview { resetReadiness() }
        currentPreview = preview
        hasPresentedCompletePreview = false
    }

    mutating func recordPreviewPresented() {
        hasPresentedCompletePreview = currentPreview?.isComplete == true
    }

    mutating func acceptReadiness() {
        guard canAcceptReadiness, let currentPreview else { return }
        readinessChoice = .accepted
        boundPreview = currentPreview
    }

    mutating func recordCorrectionSaved() {}
    mutating func recordContributionSaved() { hasSavedContribution = true }
    mutating func recordContributionRemoved() { hasSavedContribution = false; resetReadiness() }
    mutating func rejectReadiness() { resetReadiness() }
    mutating func invalidateForNoteChange() { currentPreview = nil; hasPresentedCompletePreview = false; resetReadiness() }

    private mutating func resetReadiness() {
        readinessChoice = .notAccepted
        boundPreview = nil
    }
}
