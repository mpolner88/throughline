# Release evidence manifests

Each release gets one immutable, date-and-build-named manifest. A manifest records what the available evidence established at the time; it does not infer a live provider or App Store state from source code, a past receipt, or a prior assertion.

Create a manifest from [TEMPLATE.md](TEMPLATE.md) before a release decision. Once recorded, do not rewrite historical findings. Add a later dated manifest or an explicitly linked correction record when evidence changes.

Every manifest must contain:

- product, version, build, and the recording date;
- source commit/tree, plus a dirty-state and reproducibility caveat when applicable;
- archive and upload evidence, including its location, retention status, and exactly what it proves;
- App Store and TestFlight state, each labeled by evidence strength;
- backend function version/hash, migrations, and content-safe provider/model/configuration identifiers, without secrets;
- canaries and tests actually run;
- decision, rollback, and known gaps.

Receipts, local archives, and provider-console observations are evidence with bounded scope. In particular, an upload receipt can establish delivery/upload but not later processing, TestFlight selection, submission, review, or release unless separately evidenced.

Keep manifests free of audio, transcripts, note text, feedback text, email addresses, credentials, and raw user or session identifiers. Release-specific mutable checklists remain separate and should link to their manifest rather than replace it.
