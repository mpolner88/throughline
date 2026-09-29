import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const publicFiles = Object.freeze([
  'index.html', 'privacy/index.html', 'support/index.html',
  'voice-to-task-list/index.html',
  'assets/discovery/agent-read.png', 'assets/discovery/record.png',
  'assets/discovery/structure.png', 'assets/discovery/throughline-proof-poster.png',
]);

async function filesUnder(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link in site output: ${path}`);
    if (entry.isDirectory()) files.push(...await filesUnder(root, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected output entry: ${path}`);
  }
  return files;
}

// Inspect the entire generated destination, not a filtered copy of approved files.
// Exact bytes protect the existing static site and policy from accidental changes.
export async function verifyPagesOutput(outputDir, sourceDir = 'docs') {
  const output = resolve(outputDir);
  const source = resolve(sourceDir);
  if (output === source) throw new Error('Output must be a separate generated directory');
  if ((await lstat(output)).isSymbolicLink()) throw new Error('Output directory must not be a symbolic link');
  const actual = await filesUnder(output);
  const unexpected = actual.filter(path => !publicFiles.includes(path));
  const missing = publicFiles.filter(path => !actual.includes(path));
  if (unexpected.length || missing.length) {
    throw new Error(`Pages allowlist mismatch: unexpected=${unexpected.join(',') || 'none'}; missing=${missing.join(',') || 'none'}`);
  }
  for (const path of publicFiles) {
    const [built, original] = await Promise.all([readFile(join(output, path)), readFile(join(source, path))]);
    if (!built.equals(original)) throw new Error(`Published bytes differ from source: ${path}`);
  }
  return { files: actual.length, routes: 4, assets: 4 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2] || process.argv.length > 4) throw new Error('Usage: node scripts/verify-pages-output.mjs OUTPUT_DIR [SOURCE_DIR]');
    console.log(JSON.stringify(await verifyPagesOutput(process.argv[2], process.argv[3])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
