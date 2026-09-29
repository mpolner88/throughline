#!/usr/bin/env node

import { createHash, createSign } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOKEN_LIFETIME_SECONDS = 600;
const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;
const API_ROOT = 'https://api.appstoreconnect.apple.com/v1';

const b64url = (value) => Buffer
  .from(typeof value === 'string' ? value : JSON.stringify(value))
  .toString('base64url');

export function buildJwt({ keyId, issuerId, privateKeyPem, now = Math.floor(Date.now() / 1000) }) {
  const header = b64url({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const payload = b64url({
    iss: issuerId,
    aud: 'appstoreconnect-v1',
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  });
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign({ key: privateKeyPem, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

function comparePosition(left, right) {
  const byDate = String(left.createdDate ?? '').localeCompare(String(right.createdDate ?? ''));
  return byDate || String(left.id ?? '').localeCompare(String(right.id ?? ''));
}

export function selectAfterCursor(submissions, cursor) {
  return [...submissions]
    .sort(comparePosition)
    .filter((submission) => !cursor || comparePosition(submission, cursor) > 0);
}

function normalizeSubmission(raw, buildAttributes = null) {
  const attributes = raw.attributes ?? {};
  const appVersion = attributes.appVersion
    ?? attributes.buildBundleShortVersion
    ?? buildAttributes?.marketingVersion
    ?? null;
  const buildNumber = attributes.buildNumber
    ?? buildAttributes?.version
    ?? null;

  return {
    id: String(raw.id ?? ''),
    kind: /crash/i.test(String(raw.type ?? '')) ? 'crash' : 'screenshot',
    createdDate: attributes.createdDate ?? null,
    feedback: attributes.comment?.trim() || null,
    appVersion: appVersion ? String(appVersion) : null,
    buildNumber: buildNumber ? String(buildNumber) : null,
    screenshots: Array.isArray(attributes.screenshots)
      ? attributes.screenshots
          .filter((shot) => typeof shot?.url === 'string' && shot.url.length > 0)
          .map((shot) => ({ url: shot.url }))
      : [],
  };
}

function localIdFor(submission) {
  const digest = createHash('sha256')
    .update(`${submission.createdDate ?? ''}\0${submission.id}`)
    .digest('hex')
    .slice(0, 16);
  const day = String(submission.createdDate ?? 'undated').slice(0, 10).replaceAll('-', '');
  return `tf-${day || 'undated'}-${digest}`;
}

function assertNoSymlinkComponents(target) {
  const absolute = resolve(target);
  const parsed = parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) continue;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error('private feedback path contains a symlink component');
    }
  }
}

function ensurePrivateDirectory(path) {
  assertNoSymlinkComponents(dirname(path));
  mkdirSync(path, { recursive: true, mode: 0o700 });
  assertNoSymlinkComponents(path);
  chmodSync(path, 0o700);
}

function writePrivateFile(path, value) {
  writeFileSync(path, value, { mode: 0o600, flag: 'wx' });
  chmodSync(path, 0o600);
}

function readLedger(root) {
  const path = join(root, '.processed.json');
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('private feedback ledger is invalid');
  }
  return parsed;
}

function writeLedger(root, ledger) {
  const finalPath = join(root, '.processed.json');
  const temporaryPath = join(root, `.processed-${process.pid}-${Date.now()}.tmp`);
  writePrivateFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(temporaryPath, finalPath);
  chmodSync(finalPath, 0o600);
}

function imageExtension(bytes) {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  throw new Error('screenshot is not a supported PNG or JPEG image');
}

async function downloadScreenshot(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`screenshot download returned ${response.status}`);
  const announcedSize = Number(response.headers?.get?.('content-length') ?? 0);
  if (announcedSize > MAX_SCREENSHOT_BYTES) throw new Error('screenshot exceeds the private intake size limit');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SCREENSHOT_BYTES) throw new Error('screenshot exceeds the private intake size limit');
  return { bytes, extension: imageExtension(bytes) };
}

export function renderPrivateSpecDraft({
  localId,
  createdDate,
  kind,
  appVersion,
  buildNumber,
  feedback,
}) {
  return [
    '# PRIVATE TestFlight feedback specification draft — DO NOT COMMIT',
    '',
    'Raw tester content and screenshot evidence belong only in `.throughline/feedback-intake/`.',
    '',
    '## Intake context',
    '',
    `- Private evidence reference: ${localId}`,
    `- Received: ${createdDate ?? 'unknown'}`,
    `- Kind: ${kind ?? 'unknown'}`,
    `- App version: ${appVersion ?? 'unknown'}`,
    `- Build: ${buildNumber ?? 'unknown'}`,
    '',
    '## Observed problem',
    '',
    feedback || '_No written comment was supplied; inspect the private screenshot or crash evidence._',
    '',
    '## Reproduction',
    '',
    '- [ ] Fill from the private evidence without copying user content into tracked files.',
    '',
    '## Expected behavior',
    '',
    '- [ ] State the user-visible outcome.',
    '',
    '## Scope and non-goals',
    '',
    '- [ ] Bound the smallest reversible change.',
    '',
    '## Authority',
    '',
    '- [ ] Classify as routine implementation or a Mike-owned product/design decision.',
    '',
    '## Acceptance',
    '',
    '- [ ] Add behavior-level acceptance checks.',
    '- [ ] Confirm raw feedback, pixels, identifiers, hashes, and local paths remain untracked.',
    '',
    '## Implementation',
    '',
    '- Pending.',
    '',
    '## Verification',
    '',
    '- Pending.',
    '',
    '## Resolution',
    '',
    '- Pending implementation, a tester-visible build, and journey recheck.',
    '',
  ].join('\n');
}

export function sanitizeForTrackedRecord(input) {
  return {
    source_class: input.sourceClass,
    app_version: input.appVersion,
    build_number: input.buildNumber,
    category: input.category,
    supporting_count: input.supportingCount,
    surface: input.surface,
    approval_state: input.approvalState,
    private_evidence_available: Boolean(input.privateEvidenceAvailable),
  };
}

export async function ingestPrivateSubmission(rawSubmission, { root, fetchImpl = fetch }) {
  const absoluteRoot = resolve(root);
  assertNoSymlinkComponents(absoluteRoot);
  ensurePrivateDirectory(absoluteRoot);
  const inbox = join(absoluteRoot, 'inbox');
  const stagingRoot = join(absoluteRoot, '.staging');
  ensurePrivateDirectory(inbox);
  ensurePrivateDirectory(stagingRoot);

  const submission = rawSubmission.feedback !== undefined
    ? rawSubmission
    : normalizeSubmission(rawSubmission, rawSubmission.build ?? null);
  if (!submission.id || !submission.createdDate) {
    throw new Error('feedback submission is missing its private ID or creation date');
  }

  const ledger = readLedger(absoluteRoot);
  if (ledger[submission.id]) {
    return { status: 'already_ingested', localId: ledger[submission.id].localId };
  }

  const localId = localIdFor(submission);
  const target = join(inbox, localId);
  if (existsSync(target)) {
    ledger[submission.id] = { localId, createdDate: submission.createdDate };
    writeLedger(absoluteRoot, ledger);
    return { status: 'already_ingested', localId };
  }

  const staging = mkdtempSync(join(stagingRoot, `${localId}-`));
  chmodSync(staging, 0o700);
  try {
    const feedback = submission.feedback || '_No written feedback was supplied._';
    writePrivateFile(join(staging, 'feedback.md'), `${feedback}\n`);
    const metadata = {
      local_id: localId,
      source_class: 'testflight_beta_feedback',
      kind: submission.kind,
      created_date: submission.createdDate,
      app_version: submission.appVersion,
      build_number: submission.buildNumber,
      screenshot_count: submission.screenshots?.length ?? 0,
    };
    writePrivateFile(join(staging, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
    writePrivateFile(join(staging, 'spec-draft.md'), renderPrivateSpecDraft({
      localId,
      createdDate: submission.createdDate,
      kind: submission.kind,
      appVersion: submission.appVersion,
      buildNumber: submission.buildNumber,
      feedback: submission.feedback,
    }));

    for (const [index, screenshot] of (submission.screenshots ?? []).entries()) {
      const { bytes, extension } = await downloadScreenshot(screenshot.url, fetchImpl);
      writePrivateFile(join(staging, `shot-${index + 1}.${extension}`), bytes);
    }

    renameSync(staging, target);
    chmodSync(target, 0o700);
    ledger[submission.id] = { localId, createdDate: submission.createdDate };
    writeLedger(absoluteRoot, ledger);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }

  return { status: 'ingested', localId, itemDir: target };
}

function parseEnvFile(path) {
  if (!existsSync(path)) throw new Error('the configured credential file does not exist');
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, name, rawValue] = match;
    values[name] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function expandHome(path) {
  if (path === '~') return homedir();
  if (path.startsWith(`~${sep}`)) return join(homedir(), path.slice(2));
  return path;
}

function requiredConfig(config, name) {
  const value = process.env[name] ?? config[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function fetchAll(path, token, fetchImpl = fetch) {
  const data = [];
  const included = [];
  let url = `${API_ROOT}${path}`;
  while (url) {
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`App Store Connect feedback request returned ${response.status}`);
    const body = await response.json();
    data.push(...(body.data ?? []));
    included.push(...(body.included ?? []));
    url = body.links?.next ?? null;
  }
  return { data, included };
}

function parseArguments(argv) {
  const args = { latest: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--latest') args.latest = true;
    else if (value === '--json') args.json = true;
    else if (value === '--app-id') args.appId = argv[++index];
    else if (value === '--env-file') args.envFile = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const root = join(repoRoot, '.throughline', 'feedback-intake');
  const envFile = args.envFile
    ? resolve(args.envFile)
    : join(repoRoot, '.env.local');
  const config = parseEnvFile(envFile);
  const appId = args.appId ?? requiredConfig(config, 'ASC_APP_ID');
  if (!/^\d+$/.test(String(appId))) throw new Error('ASC_APP_ID must be numeric');
  const keyPath = expandHome(requiredConfig(config, 'ASC_KEY_PATH'));
  if (!isAbsolute(keyPath)) throw new Error('ASC_KEY_PATH must be absolute');
  const token = buildJwt({
    keyId: requiredConfig(config, 'ASC_KEY_ID'),
    issuerId: requiredConfig(config, 'ASC_ISSUER_ID'),
    privateKeyPem: readFileSync(keyPath, 'utf8'),
  });

  const { data, included } = await fetchAll(
    `/apps/${appId}/betaFeedbackScreenshotSubmissions?limit=200&sort=-createdDate&include=build`,
    token,
  );
  const builds = new Map(
    included
      .filter((resource) => resource.type === 'builds')
      .map((resource) => [resource.id, resource.attributes ?? {}]),
  );
  let submissions = data.map((resource) => {
    const buildId = resource.relationships?.build?.data?.id;
    return normalizeSubmission(resource, builds.get(buildId));
  });
  submissions = selectAfterCursor(submissions, null).reverse();
  if (args.latest) submissions = submissions.slice(0, 1);

  const items = [];
  for (const submission of submissions) {
    items.push(await ingestPrivateSubmission(submission, { root }));
  }
  const ingested = items.filter((item) => item.status === 'ingested');
  const summary = {
    polled_at: new Date().toISOString(),
    seen: data.length,
    ingested: ingested.length,
    already_ingested: items.length - ingested.length,
    private_item_refs: ingested.map((item) => item.localId),
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`${summary.seen} feedback item(s) found; ${summary.ingested} added to the private inbox.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`private-testflight-feedback: ${error.message}`);
    process.exitCode = 1;
  });
}
