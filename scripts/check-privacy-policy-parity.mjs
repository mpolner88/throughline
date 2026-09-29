import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REQUIRED_EVALUATION_SEMANTICS = [
  "explicit grade", "content correction", "private quality evaluation", "30-day",
  "remove the evaluation contribution", "delete the note", "delete your account",
  "not use evaluation contributions to train or fine-tune models", "automatic promotion",
  "advertising", "normal transcription and extraction",
];

function normalizeText(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&quot;/giu, '"')
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

export function extractMarkdownSections(source) {
  const sections = new Map();
  const matches = [...String(source).matchAll(/^##\s+(.+?)\s*$([\s\S]*?)(?=^##\s+|(?![\s\S]))/gmu)];
  for (const match of matches) sections.set(normalizeText(match[1]), normalizeText(match[2]));
  return sections;
}

export function extractHTMLSections(source) {
  const sections = new Map();
  const matches = [...String(source).matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|<\/main>|(?![\s\S]))/giu)];
  for (const match of matches) sections.set(normalizeText(match[1]), normalizeText(match[2]));
  return sections;
}

export function analyzePrivacyPolicyDocuments(markdown, html) {
  const markdownSections = extractMarkdownSections(markdown);
  const htmlSections = extractHTMLSections(html);
  const markdownEvaluation = markdownSections.get("private evaluation") ?? "";
  const htmlEvaluation = htmlSections.get("private evaluation") ?? "";
  const errors = [];
  const combined = normalizeText(`${markdown}\n${html}`);

  if (combined.includes("before the app starts the first recording")) errors.push("False first-recording permission claim remains");
  if (/withdraw.{0,100}(permission|ai processing).{0,100}settings|settings.{0,100}withdraw/iu.test(combined)) errors.push("False Settings withdrawal claim remains");
  if (!markdownEvaluation) errors.push("Markdown is missing the Private evaluation section");
  if (!htmlEvaluation) errors.push("HTML is missing the Private evaluation section");
  for (const phrase of REQUIRED_EVALUATION_SEMANTICS) {
    if (!markdownEvaluation.includes(phrase)) errors.push(`Markdown private evaluation missing: ${phrase}`);
    if (!htmlEvaluation.includes(phrase)) errors.push(`HTML private evaluation missing: ${phrase}`);
  }
  return { errors, markdownEvaluation, htmlEvaluation };
}

export async function checkPrivacyPolicyParity({ markdownPath, htmlPath }) {
  const [markdown, html] = await Promise.all([readFile(markdownPath, "utf8"), readFile(htmlPath, "utf8")]);
  return analyzePrivacyPolicyDocuments(markdown, html);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await checkPrivacyPolicyParity({
    markdownPath: new URL("../docs/privacy-policy.md", import.meta.url),
    htmlPath: new URL("../docs/privacy/index.html", import.meta.url),
  });
  if (result.errors.length) {
    for (const error of result.errors) console.error(`privacy-policy-parity: ${error}`);
    process.exitCode = 1;
  } else console.log("privacy-policy-parity: ok");
}
