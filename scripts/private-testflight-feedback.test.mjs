import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildJwt,
  ingestPrivateSubmission,
  renderPrivateSpecDraft,
  sanitizeForTrackedRecord,
  selectAfterCursor,
} from './private-testflight-feedback.mjs';

const KEY = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const tempRoot = () => mkdtempSync(join(realpathSync(tmpdir()), 'throughline-private-feedback-'));

const SCREENSHOT_SUBMISSION = {
  type: 'betaFeedbackScreenshotSubmissions',
  id: 'apple-submission-secret-123',
  attributes: {
    createdDate: '2026-08-25T16:45:00.000Z',
    comment: 'The synthetic button overlaps the bottom controls.',
    email: 'tester@example.test',
    deviceModel: 'iPhone16,2',
    osVersion: '18.5',
    screenshots: [
      { url: 'https://example.test/private-shot?signature=secret' },
    ],
  },
  relationships: { build: { data: { id: 'build-secret-456' } } },
  build: { appVersion: '1.0.5', buildNumber: '2026082401' },
};

const pngResponse = () => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'image/png' }),
  arrayBuffer: async () => new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]).buffer,
});

test('buildJwt creates a ten-minute App Store Connect ES256 token', () => {
  const token = buildJwt({
    keyId: 'KEY123',
    issuerId: 'issuer-123',
    privateKeyPem: KEY.privateKey,
    now: 1_700_000_000,
  });
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

  assert.deepEqual(decode(encodedHeader), { alg: 'ES256', kid: 'KEY123', typ: 'JWT' });
  assert.deepEqual(decode(encodedPayload), {
    iss: 'issuer-123',
    aud: 'appstoreconnect-v1',
    iat: 1_700_000_000,
    exp: 1_700_000_600,
  });
  assert.equal(Buffer.from(encodedSignature, 'base64url').length, 64);
});

test('selectAfterCursor keeps a later Apple ID when two submissions share a timestamp', () => {
  const submissions = [
    { id: 'c', createdDate: '2026-08-25T16:45:00.000Z' },
    { id: 'a', createdDate: '2026-08-25T16:45:00.000Z' },
    { id: 'older', createdDate: '2026-08-25T16:44:59.000Z' },
  ];

  assert.deepEqual(
    selectAfterCursor(submissions, {
      createdDate: '2026-08-25T16:45:00.000Z',
      id: 'b',
    }).map(({ id }) => id),
    ['c'],
  );
});

test('private ingestion writes only to the ignored inbox with private permissions', async () => {
  const root = join(tempRoot(), '.throughline', 'feedback-intake');

  const result = await ingestPrivateSubmission(SCREENSHOT_SUBMISSION, {
    root,
    fetchImpl: async () => pngResponse(),
  });

  const itemDir = join(root, 'inbox', result.localId);
  assert.deepEqual(
    readdirSync(itemDir).sort(),
    ['feedback.md', 'metadata.json', 'shot-1.png', 'spec-draft.md'],
  );
  assert.equal(lstatSync(itemDir).mode & 0o777, 0o700);
  for (const fileName of readdirSync(itemDir)) {
    assert.equal(lstatSync(join(itemDir, fileName)).mode & 0o777, 0o600);
  }
  assert.match(readFileSync(join(itemDir, 'feedback.md'), 'utf8'), /overlaps the bottom controls/);
  assert.doesNotMatch(readFileSync(join(itemDir, 'metadata.json'), 'utf8'), /tester@example\.test/);
  assert.doesNotMatch(readFileSync(join(itemDir, 'metadata.json'), 'utf8'), /signature=secret/);
});

test('a repeated poll does not download or create the same submission twice', async () => {
  const root = join(tempRoot(), '.throughline', 'feedback-intake');
  const first = await ingestPrivateSubmission(SCREENSHOT_SUBMISSION, {
    root,
    fetchImpl: async () => pngResponse(),
  });
  const second = await ingestPrivateSubmission(SCREENSHOT_SUBMISSION, {
    root,
    fetchImpl: async () => {
      throw new Error('duplicate feedback must not download again');
    },
  });

  assert.equal(second.status, 'already_ingested');
  assert.equal(second.localId, first.localId);
  assert.equal(readdirSync(join(root, 'inbox')).length, 1);
});

test('an unsupported screenshot leaves no partial inbox item', async () => {
  const root = join(tempRoot(), '.throughline', 'feedback-intake');
  await assert.rejects(
    ingestPrivateSubmission(SCREENSHOT_SUBMISSION, {
      root,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new TextEncoder().encode('<html>not an image</html>').buffer,
      }),
    }),
    /supported PNG or JPEG/,
  );

  assert.deepEqual(readdirSync(join(root, 'inbox')), []);
  assert.equal(existsSync(join(root, '.staging')), true);
  assert.deepEqual(readdirSync(join(root, '.staging')), []);
});

test('a symlinked private root is rejected before any screenshot download', async () => {
  const base = tempRoot();
  const real = join(base, 'real');
  const linked = join(base, 'linked');
  mkdirSync(real);
  symlinkSync(real, linked);

  await assert.rejects(
    ingestPrivateSubmission(SCREENSHOT_SUBMISSION, {
      root: linked,
      fetchImpl: async () => {
        throw new Error('must reject the path first');
      },
    }),
    /symlink/i,
  );
  assert.deepEqual(readdirSync(real), []);
});

test('the private spec draft carries evidence while remaining explicitly non-trackable', () => {
  const draft = renderPrivateSpecDraft({
    localId: 'local-feedback-1',
    createdDate: '2026-08-25T16:45:00.000Z',
    kind: 'screenshot',
    appVersion: '1.0.5',
    buildNumber: '2026082401',
    feedback: 'The button overlaps the bottom controls.',
  });

  assert.match(draft, /PRIVATE.*DO NOT COMMIT/i);
  assert.match(draft, /Observed problem/);
  assert.match(draft, /The button overlaps the bottom controls\./);
  assert.match(draft, /Acceptance/);
  assert.match(draft, /Resolution/);
});

test('the tracked record allowlist excludes raw feedback, Apple IDs, screenshots, hashes, and local paths', () => {
  const tracked = sanitizeForTrackedRecord({
    sourceClass: 'testflight_beta_feedback',
    appVersion: '1.0.5',
    buildNumber: '2026082401',
    category: 'usability',
    supportingCount: 1,
    surface: 'recording_result',
    approvalState: 'selected',
    privateEvidenceAvailable: true,
    feedback: 'secret comment',
    email: 'tester@example.test',
    appleSubmissionId: 'secret-apple-id',
    screenshotPath: '/private/shot.png',
    contentHash: 'secret-hash',
  });

  assert.deepEqual(tracked, {
    source_class: 'testflight_beta_feedback',
    app_version: '1.0.5',
    build_number: '2026082401',
    category: 'usability',
    supporting_count: 1,
    surface: 'recording_result',
    approval_state: 'selected',
    private_evidence_available: true,
  });
  assert.doesNotMatch(
    JSON.stringify(tracked),
    /secret comment|tester@example|secret-apple|\/private\/shot|secret-hash/,
  );
});
