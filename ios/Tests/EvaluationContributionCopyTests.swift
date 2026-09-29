import Foundation

enum EvaluationContributionCopyTests {
    static func run() {
        expect(EvaluationContributionCopy.disclosure == "Private quality check. Saving this grade or a content correction may keep this recording’s audio past 30 days until you remove the contribution. Not used to train models. Learn more.", "Approved disclosure must remain exact")
        expect(EvaluationContributionCopy.privacyLinkLabel == "How we treat recordings", "The visible privacy disclosure must be one calm link")
        expect(EvaluationContributionCopy.previewTitle == "What your agent will read", "Preview title must describe agent-facing output")
        expect(EvaluationContributionCopy.previewMeaning.localizedCaseInsensitiveContains("exact note revision"), "Preview must explain revision binding")
        expect(EvaluationContributionCopy.readinessMeaning.localizedCaseInsensitiveContains("all 14 fields"), "Readiness must describe complete visible output")
        expect(EvaluationContributionCopy.readinessMeaning.localizedCaseInsensitiveContains("off by default"), "Readiness must remain default-off")
        expect(EvaluationContributionCopy.removalLabel == "Remove private quality contribution", "Removal action must be explicit")
        expect(EvaluationContributionCopy.removalMeaning.localizedCaseInsensitiveContains("does not undo your visible note correction"), "Removal must preserve visible edits")
        expect(EvaluationContributionCopy.explanationPrivacy.localizedCaseInsensitiveContains("excluded from private evaluation"), "Free text must remain quarantined")

        expect(EvaluationRatingMode.resolve(currentRevisionID: nil) == .standard, "A note without lineage must retain a usable rating path")
        expect(EvaluationRatingMode.resolve(currentRevisionID: "not-a-uuid") == .standard, "Malformed lineage must fail back to standard rating")
        expect(
            EvaluationRatingMode.resolve(currentRevisionID: "22222222-2222-4222-8222-222222222222") == .privateLineage,
            "A valid immutable revision must use the exact-revision private evaluation path"
        )
    }
}
