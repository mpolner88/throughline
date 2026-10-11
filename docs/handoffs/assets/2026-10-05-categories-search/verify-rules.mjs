// Runs the rule vectors in selected-mock.html against the mock's RULES section, without a browser or network.
// Usage: node docs/handoffs/assets/2026-10-05-categories-search/verify-rules.mjs [path/to/selected-mock.html]
// Exits 1 if any vector fails. Synthetic strings only.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), 'selected-mock.html');
const html = readFileSync(file, 'utf8');
const rules = html.match(/\/\/ RULES-BEGIN\n([\s\S]*?)\/\/ RULES-END/)?.[1];
const vectors = html.match(/<script type="application\/json" id="rule-vectors">\n([\s\S]*?)\n<\/script>/)?.[1];
if (!rules || !vectors) { console.error('RULES section or rule-vectors block not found'); process.exit(1); }

const V = JSON.parse(vectors);
const results = new Function(`${rules}\nreturn runVectors;`)()(V);

// Independent check of the expected weekdays, using the platform calendar in each vector's time zone rather than
// the rule's own table.
V.days.filter(([, , , want]) => /^[A-Z][a-z]{2}$/.test(want ?? '')).forEach(([at, , tz, want]) => {
  const got = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(new Date(at));
  results.push({ name: `calendar weekday of ${at} in ${tz}`, ok: got === want, got, want });
});

const failed = results.filter(r => !r.ok);
for (const r of failed) console.log(`FAIL ${r.name}\n  got  ${JSON.stringify(r.got)}\n  want ${JSON.stringify(r.want)}`);
console.log(`${results.length - failed.length}/${results.length} rule vectors pass`);
process.exit(failed.length ? 1 : 0);
