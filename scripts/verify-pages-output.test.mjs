import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { publicFiles, verifyPagesOutput } from './verify-pages-output.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pages-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['source', 'output']) for (const path of publicFiles) {
    const target = join(root, dir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `synthetic ${path}`);
  }
  return { source: join(root, 'source'), output: join(root, 'output') };
}

test('accepts exactly the four routes and four unchanged assets', async t => {
  const { source, output } = await fixture(t);
  assert.deepEqual(await verifyPagesOutput(output, source), { files: 8, routes: 4, assets: 4 });
});
test('rejects leaked operating HTML and images anywhere in output', async t => {
  const { source, output } = await fixture(t);
  await mkdir(join(output, 'evidence', 'assets'), { recursive: true });
  await writeFile(join(output, 'evidence', 'report.html'), 'synthetic');
  await writeFile(join(output, 'evidence', 'assets', 'mock.png'), 'synthetic');
  await assert.rejects(verifyPagesOutput(output, source), /allowlist mismatch/);
});
test('rejects a missing intended page', async t => {
  const { source, output } = await fixture(t);
  await rm(join(output, 'privacy', 'index.html'));
  await assert.rejects(verifyPagesOutput(output, source), /missing=privacy\/index.html/);
});
test('rejects changed policy bytes', async t => {
  const { source, output } = await fixture(t);
  await writeFile(join(output, 'privacy', 'index.html'), 'changed');
  await assert.rejects(verifyPagesOutput(output, source), /bytes differ/);
});
test('rejects symlinks even at approved paths', async t => {
  const { source, output } = await fixture(t);
  await rm(join(output, 'index.html'));
  await symlink(join(source, 'index.html'), join(output, 'index.html'));
  await assert.rejects(verifyPagesOutput(output, source), /Symbolic link/);
});

for (const path of ['surprise.txt', 'newdir/private.html', 'assets/discovery/unapproved.png', 'privacy/support/index.html']) {
  test(`rejects an unexpected output path: ${path}`, async t => {
    const { source, output } = await fixture(t);
    await mkdir(dirname(join(output, path)), { recursive: true });
    await writeFile(join(output, path), 'synthetic exclusion probe');
    await assert.rejects(verifyPagesOutput(output, source), /allowlist mismatch/);
  });
}
