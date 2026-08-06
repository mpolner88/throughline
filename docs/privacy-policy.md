# Throughline Privacy Policy

Effective date: August 5, 2026

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

Product-usage events do not contain recordings, transcripts, note text, extracted tasks, names, email addresses, or the text of product feedback. Events created while you are signed in are associated with your account. Events created before sign-in use only a random identifier for the current app session. Throughline does not use a persistent advertising or device identifier.

## Audio and Transcript Retention

Audio recordings are retained only as long as needed for the product experience and are configured for a 30-day retention window. Transcripts and structured notes persist so your saved memories remain available in the app and through your MCP connection.

When you delete your account, Throughline deletes your account, saved memories, recordings, feedback, associated product-usage events, and agent tokens.

## Storage and Processors

Throughline uses Supabase for account authentication, database storage, file storage, and Edge Functions. The production Supabase project is configured in the United States region `us-west-2`.

After you explicitly allow AI processing, each audio recording you choose to create is sent through Throughline's Supabase Edge Function to Groq, our third-party AI processor. Groq receives:

- The audio recording, to create a transcript.
- The transcript and text derived from it, to create summaries, tasks, and other structured note fields.

Throughline uses Groq only to provide these transcription and note-creation features. Groq states that it does not use API inputs or outputs to train its models. Groq does not retain inference customer data by default, but may temporarily retain inputs and outputs for service reliability or abuse monitoring for up to 30 days unless zero-data-retention controls apply. See [Your Data in GroqCloud](https://console.groq.com/docs/your-data) and [Groq's privacy and service notices](https://console.groq.com/docs/legal).

Supabase and Groq process data on Throughline's behalf under their service terms and security commitments. Throughline does not sell this data or permit either processor to use it for third-party advertising.

## AI Processing Permission

Before the app starts the first recording, it identifies the data sent to Supabase and Groq, explains why it is sent, and asks whether you allow AI processing. If you choose "not now," no recording is created or sent.

You can review or withdraw this permission in Settings. Withdrawing permission prevents future recordings from being sent. Delete individual notes or your account to remove data Throughline has already stored, subject to the retention periods described above.

## MCP Access

Agent access is opt-in. Creating an agent token allows an MCP client to read your saved Throughline notes. You can revoke agent tokens from the app.

## Your Choices

You can:

- Stop creating new recordings at any time.
- Decline or withdraw AI processing permission.
- Revoke agent tokens.
- Sign out of the app.
- Delete your account and associated data from settings.

## Contact

For privacy or support requests, visit the Throughline support page: `https://mpolner88.github.io/throughline/support/`.
