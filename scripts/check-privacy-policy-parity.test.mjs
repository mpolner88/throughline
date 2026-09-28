import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzePrivacyPolicyDocuments, extractHTMLSections, extractMarkdownSections } from "./check-privacy-policy-parity.mjs";

const markdownPath = new URL("../docs/privacy-policy.md", import.meta.url);
const htmlPath = new URL("../docs/privacy/index.html", import.meta.url);

test("parses Markdown and HTML by semantic section", () => {
  const md = extractMarkdownSections("## Private evaluation\nOnly explicit grades contribute.\n\n## Contact\nSupport.");
  const html = extractHTMLSections("<h2>Private evaluation</h2><p>Only explicit grades contribute.</p><h2>Contact</h2><p>Support.</p>");
  assert.equal(md.get("private evaluation"), "only explicit grades contribute.");
  assert.equal(html.get("private evaluation"), "only explicit grades contribute.");
});

test("rejects false permission-modal and Settings-withdrawal claims", () => {
  const md = "## AI Processing Permission\nBefore the app starts the first recording, it asks whether you allow AI processing.\nYou can withdraw this permission in Settings.";
  const html = "<h2>AI processing permission</h2><p>Before the app starts the first recording, it asks whether you allow AI processing.</p><p>You can withdraw this permission in Settings.</p>";
  const result = analyzePrivacyPolicyDocuments(md, html);
  assert.ok(result.errors.some((error) => error.includes("first-recording permission")));
  assert.ok(result.errors.some((error) => error.includes("Settings withdrawal")));
});

test("local sources carry the same private-evaluation semantics", async () => {
  const [md, html] = await Promise.all([readFile(markdownPath, "utf8"), readFile(htmlPath, "utf8")]);
  const result = analyzePrivacyPolicyDocuments(md, html);
  assert.deepEqual(result.errors, []);
  for (const phrase of [
    "explicit grade", "content correction", "private quality evaluation", "30-day",
    "remove the evaluation contribution", "delete the note", "delete your account",
    "not use evaluation contributions to train or fine-tune models", "automatic promotion",
    "advertising", "normal transcription and extraction",
  ]) {
    assert.ok(result.markdownEvaluation.includes(phrase), `Markdown missing: ${phrase}`);
    assert.ok(result.htmlEvaluation.includes(phrase), `HTML missing: ${phrase}`);
  }
});

test("semantic parity does not require byte-identical markup", () => {
  const md = "## Private Evaluation\nAn explicit grade or content correction is for private quality evaluation only. Audio can remain past the 30-day window until you remove the evaluation contribution, delete the note, or delete your account. We do not use evaluation contributions to train or fine-tune models, for automatic promotion, or advertising. This is separate from normal transcription and extraction.";
  const html = "<h2>Private evaluation</h2><p>An <strong>explicit grade</strong> or content correction is for private quality evaluation only. Audio can remain past the 30-day window until you remove the evaluation contribution, delete the note, or delete your account.</p><p>We do not use evaluation contributions to train or fine-tune models, for automatic promotion, or advertising. This is separate from normal transcription and extraction.</p>";
  assert.deepEqual(analyzePrivacyPolicyDocuments(md, html).errors, []);
});
