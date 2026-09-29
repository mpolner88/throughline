# Throughline Privacy Policy

Last updated: September 28, 2026

Throughline is a voice note app. You record a note, Throughline turns it into a transcript and structured note, and you can make that note readable by an agent through your personal MCP connection.

## Data We Collect

- Account data: email address and account identifier.
- Voice notes: audio recordings that you choose to create.
- Note content: transcripts, summaries, extracted tasks, important items, tags, and edits you make.
- Agent connection data: MCP access tokens you create or revoke.
- Feedback: extraction quality ratings, corrections, and product feedback you choose to submit.
- Product usage: basic events such as app launches, onboarding progress, screens and features used, recording-processing outcomes, app version, build number, and a random identifier that lasts only for the current app session.

We do not sell personal data. We do not use this data for third-party advertising or tracking.

## How We Use Data

We use your data to:

- Create, transcribe, summarize, and save your voice notes.
- Show your notes, tasks, and important items in the app.
- Make your saved notes available to your connected MCP client when you create an agent token.
- Understand where the product experience succeeds or breaks down and improve it using basic product-usage events.
- Improve extraction quality and the broader product experience using feedback you intentionally submit.
- Maintain account security and support account deletion.

Product-usage events do not contain recordings, transcripts, note text, extracted tasks, names, email addresses, or the text of product feedback. Events received with a signed-in request are associated with your account. Events received before Throughline can authenticate you use only a random identifier for the current app session. Throughline does not use a persistent advertising or device identifier.

## Audio and Transcript Retention

Ordinary audio recordings are retained only as long as needed for the product experience and are configured for a 30-day retention window. Transcripts and structured notes persist so your saved memories remain available in the app and through your MCP connection.

## Private Evaluation

Private evaluation is not currently enabled. The following describes the planned feature; it does not change how your existing notes are used today. If the feature becomes available, the app will show a contextual private-quality notice before you contribute.

Under the planned feature, saving an explicit grade or a content correction after seeing the notice will make that recording an evaluation contribution for private quality evaluation. Its audio may remain past the ordinary 30-day window until you remove the evaluation contribution, delete the note, or delete your account.

Throughline will use an evaluation contribution to measure transcription and extraction quality against the exact note revision you reviewed. Only the person who recorded the note will provide its grades and corrections; contributions will not enter a human-review queue. Throughline does not use evaluation contributions to train or fine-tune models, for automatic promotion of product changes, for advertising, or for tracking. Optional free-text explanations will be kept separately and excluded from evaluation scoring and automated changes.

When the feature is available, you will be able to remove the evaluation contribution from the evaluated note. Removal will stop private quality use and extended audio retention, delete linked private evaluation artifacts, and invalidate derived evaluation cases. It will not undo a visible correction you made to the note. Deleting the note or deleting your account will also remove the contribution.

Private evaluation is separate from normal transcription and extraction. Creating a recording still sends audio and derived text to the processors described below so Throughline can provide transcription and structured-note functionality.

## Account Deletion

When you delete your account, Throughline deletes your account, saved memories, recordings, feedback, associated product-usage events, and agent tokens. Throughline also requests deletion of the matching pseudonymous analytics profile and its historical events from PostHog. PostHog processes historical-event deletion asynchronously.

## Storage and Processors

Throughline uses Supabase for account authentication, database storage, file storage, and Edge Functions. The production Supabase project is configured in the United States region `us-west-2`.

Throughline uses PostHog Cloud US to analyze a limited, server-side copy of product-usage events. Before sending an event, Throughline replaces the account or session identifier with a pseudonymous identifier generated using a key held by Throughline. These events remain linkable to your account by Throughline when you are signed in. Throughline disables GeoIP enrichment and does not use PostHog's iOS SDK, autocapture, session replay, advertising identifiers, or device fingerprinting. PostHog does not receive voice recordings, transcripts, note content, feedback text, names, or email addresses.

Each audio recording you choose to create is sent through Throughline's Supabase Edge Function to Groq, our third-party AI processor. Groq receives:

- The audio recording, to create a transcript.
- The transcript and text derived from it, to create summaries, tasks, and other structured note fields.

Throughline uses Groq only to provide these transcription and note-creation features. Groq's service terms prohibit using API inputs or outputs to train or fine-tune models without the customer's explicit permission or instruction. Throughline does not grant that permission for your note processing. Groq does not retain inference customer data by default, but may temporarily retain inputs and outputs for service reliability or abuse monitoring for up to 30 days, or longer when legally required, unless zero-data-retention controls apply. See [Your Data in GroqCloud](https://console.groq.com/docs/your-data) and [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement).

Supabase, Groq, and PostHog process data on Throughline's behalf under their service terms and security commitments. Throughline does not sell this data or permit any processor to use it for third-party advertising.

## AI Processing

When you choose to create a recording, Throughline sends it for the normal transcription and extraction processing described above. The current app has no separate permission prompt for AI processing and no separate AI-processing preference in Settings. You can stop creating recordings, delete individual notes, or delete your account.

## MCP Access

Agent access is opt-in. Creating an agent token allows an MCP client to read your saved Throughline notes. You can revoke agent tokens from the app.

## Your Choices

You can:

- Stop creating new recordings at any time.
- When Private Evaluation becomes available, remove a contribution from the evaluated note.
- Revoke agent tokens.
- Sign out of the app.
- Delete your account and associated data from settings.

## Contact

For privacy or support requests, visit the Throughline support page: `https://mpolner88.github.io/throughline/support/`.
