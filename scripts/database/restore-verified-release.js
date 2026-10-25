/** Restore exact Git release bytes into OS temp, never rewrite working snapshots.
 * Default: preflight only. --apply: import into the empty local development DB.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { runCouchDbImport } from './import-couchdb.js';
import { JobApplicationRepository } from '../../backend/src/repositories/job-application.repository.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Only --apply is supported.');
const gitBytes = name => execFileSync('git', ['show', `HEAD:${name}`], { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const manifestPath = path.join(root, 'data/processed/manifests/final-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.deepEqual(manifest, JSON.parse(gitBytes('data/processed/manifests/final-manifest.json').toString('utf8')), 'Working manifest differs from committed release');
assert.match(manifest.immutable_release_dir, /^data\/processed\/releases\/[a-zA-Z0-9_.-]+$/);
const releaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recruithub-verified-release-'));
const verified = [];
for (const [name, entry] of Object.entries(manifest.output_files)) {
  assert.match(name, /^[a-z_]+\.jsonl$/);
  const bytes = gitBytes(`${manifest.immutable_release_dir}/${name}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  assert.equal(sha256, entry.sha256, `Committed ${name} does not match manifest`);
  const lines = bytes.toString('utf8').split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, entry.record_count, `${name} count mismatch`);
  for (const line of lines) JSON.parse(line);
  fs.writeFileSync(path.join(releaseDir, name), bytes);
  verified.push({ name, records: lines.length, sha256 });
}
const repo = new JobApplicationRepository();
const host = new URL(repo.config.url).hostname;
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(host), 'Only a local development database is allowed');
assert.equal(repo.config.database, 'recruitment_db', 'Unexpected target database');
async function assertNoBusinessDocuments() {
  const metadata = await repo.http('');
  assert.ok(metadata && metadata.doc_count <= 100, 'Database is not empty: refusing restore');
  const page = await repo.http('_all_docs?limit=101');
  assert.ok(page.rows.every(row => row.id.startsWith('_design/')), 'Existing business document: refusing restore');
}
await runCouchDbImport({ releaseDir, finalManifestPath: manifestPath, dryRun: true });
if (apply) {
  await assertNoBusinessDocuments();
  await runCouchDbImport({ releaseDir, finalManifestPath: manifestPath, allowExistingDb: true });
}
const evidence = { releaseId: manifest.release_id, database: repo.config.database, applied: apply, verified, releaseDir };
fs.writeFileSync(path.join(os.tmpdir(), 'recruithub-release-restore-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ releaseId: evidence.releaseId, database: evidence.database, applied: apply, verifiedFiles: verified.length }));
