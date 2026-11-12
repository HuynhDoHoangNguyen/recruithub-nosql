import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { operationalFixture } from '../helpers/admin-backup-operational-fixtures.js';
import { issueAccessToken, ACCESS_TOKEN_TTL_SECONDS } from '../../src/services/jwt-access-token.js';
import { BackupJobStore } from '../../src/services/admin-backup-job.service.js';

async function login(f, user) {
  const response = await f.request('/auth/login', { body: { email: user.email, password: f.password } });
  assert.equal(response.status, 200);
  return (await response.json()).data.accessToken;
}

async function waitForJob(f, token, endpoint, id) {
  let value;
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await f.request(`${endpoint}/${id}`, { token });
    assert.equal(response.status, 200);
    value = (await response.json()).data;
    if (!['QUEUED', 'RUNNING'].includes(value.status)) return value;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`Job ${id} did not finish: ${JSON.stringify(value)}`);
}

test('BR-005B real login/me/JWT for three roles and two Admins uses isolated process/CouchDB/private spool', {
  skip: process.env.BR005_DOCKER_INTEGRATION !== '1', timeout: 90000,
}, async t => {
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const f = await operationalFixture(t);
  assert.equal((await f.request('/admin/backups/sources')).status, 401);
  const tokens = {};
  for (const [name, user] of Object.entries(f.users)) {
    const login = await f.request('/auth/login', { body: { email: user.email, password: f.password } });
    assert.equal(login.status, 200, `Real login ${name}`);
    const data = (await login.json()).data; tokens[name] = data.accessToken;
    assert.equal(data.user.role, user.role); assert.equal(data.user.id, user._id);
    const me = await f.request('/auth/me', { token: tokens[name] }); assert.equal(me.status, 200);
    assert.equal((await me.json()).data.user.id, user._id);
    const sources = await f.request('/admin/backups/sources', { token: tokens[name] });
    assert.equal(sources.status, user.role === 'ADMIN' ? 200 : 403);
  }
  assert.equal((await f.request('/auth/login', { body: { email: f.users.admin.email, password: 'WrongPassword123' } })).status, 401);
  if (process.platform === 'win32') {
    const acl = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; Import-Module \"$PSHOME/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1\"; $a=Get-Acl -LiteralPath $env:BR005_SPOOL; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $r=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])); if(-not $a.AreAccessRulesProtected -or $r.Count -ne 1 -or $r[0].IdentityReference.Value -ne $sid -or $r[0].FileSystemRights -ne 'FullControl'){exit 2}"], { env: { ...process.env, BR005_SPOOL: f.env.BR005_SPOOL }, windowsHide: true });
    assert.equal(acl.status, 0, 'Spool ACL restricted to backend OS user');
  } else assert.equal((await fs.stat(f.env.BR005_SPOOL)).mode & 0o077, 0);
  const saved = await f.couchCall(`/${f.database}/${encodeURIComponent(f.users.admin._id)}`);
  await f.couchCall(`/${f.database}/${encodeURIComponent(saved._id)}`, 'PUT', { ...saved, account_status: 'LOCKED' });
  assert.equal((await f.request('/admin/backups/sources', { token: tokens.admin })).status, 401);
  t.diagnostic('Four real logins/me verified; guest401, Candidate/Recruiter403, Admin sources200, locked existing token401; private spool ACL verified.');
});

test('BR-005C real HTTP roundtrip enforces owner isolation, validates signed archive and restores private exact target', {
  skip: process.env.BR005_DOCKER_INTEGRATION !== '1', timeout: 120000,
}, async t => {
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const f = await operationalFixture(t);
  const admin = await login(f, f.users.admin);
  const otherAdmin = await login(f, f.users.otherAdmin);
  const before = await f.couchCall('/' + f.database);
  const created = await f.request('/admin/backups', { token: admin, body: { source_id: 'business' } });
  assert.equal(created.status, 202);
  const backupId = (await created.json()).data.job_id;
  assert.equal((await f.request(`/admin/backups/${backupId}`, { token: otherAdmin })).status, 404);
  assert.equal((await f.request(`/admin/backups/${backupId}/download`, { token: otherAdmin })).status, 404);
  const backup = await waitForJob(f, admin, '/admin/backups', backupId);
  assert.equal(backup.status, 'SUCCEEDED', JSON.stringify(backup.error));
  const download = await f.request(`/admin/backups/${backupId}/download`, { token: admin });
  assert.equal(download.status, 200);
  const archive = Buffer.from(await download.arrayBuffer()); assert.ok(archive.length > 0);
  const uploaded = await f.request('/admin/backups/validate', { token: admin, body: archive, raw: true });
  assert.equal(uploaded.status, 202);
  const validationId = (await uploaded.json()).data.job_id;
  assert.equal((await f.request(`/admin/backups/${validationId}`, { token: otherAdmin })).status, 404);
  const validation = await waitForJob(f, admin, '/admin/backups', validationId);
  assert.equal(validation.status, 'SUCCEEDED', JSON.stringify(validation.error));
  assert.equal(validation.validation_state, 'AVAILABLE');
  const protectedTarget = await f.request('/admin/restores', { token: admin, body: { validation_id: validationId, target_database: f.database, confirm: true } });
  assert.equal(protectedTarget.status, 400);
  const target = `recruithub_restore_test_${randomUUID().replaceAll('-', '')}`;
  const restored = await f.request('/admin/restores', { token: admin, body: { validation_id: validationId, target_database: target, confirm: true } });
  assert.equal(restored.status, 202);
  const restoreId = (await restored.json()).data.job_id;
  assert.equal((await f.request(`/admin/restores/${restoreId}`, { token: otherAdmin })).status, 404);
  const result = await waitForJob(f, admin, '/admin/restores', restoreId);
  assert.equal(result.status, 'SUCCEEDED', JSON.stringify(result.error));
  assert.equal(result.result.verified_documents, before.doc_count);
  const sourceAfter = await f.couchCall('/' + f.database); assert.equal(sourceAfter.update_seq, before.update_seq);
  const targetInfo = await f.couchCall('/' + target); assert.equal(targetInfo.doc_count, before.doc_count);
  assert.equal((await fetch(`${new URL(f.env.COUCHDB_URL).origin}/${target}`)).status, 401);
  assert.equal((await f.request('/admin/restores', { token: admin, body: { validation_id: validationId, target_database: `recruithub_restore_test_reuse_${randomUUID().replaceAll('-', '')}`, confirm: true } })).status, 409);
  t.diagnostic(`HTTP real roundtrip docs=${before.doc_count}; source sequence unchanged; private target=${target}; cross-Admin owner isolation verified.`);
});

test('BR-005C rejects expired JWT and tampered upload before any target database is created', {
  skip: process.env.BR005_DOCKER_INTEGRATION !== '1', timeout: 120000,
}, async t => {
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const f = await operationalFixture(t);
  const admin = await login(f, f.users.admin);
  const expired = issueAccessToken({ sub: f.users.admin._id, role: 'ADMIN' }, { secret: f.env.JWT_ACCESS_SECRET,
    nowMs: Date.now() - (ACCESS_TOKEN_TTL_SECONDS + 5) * 1000 });
  assert.equal((await f.request('/admin/backups/sources', { token: expired })).status, 401);
  const created = await f.request('/admin/backups', { token: admin, body: { source_id: 'business' } });
  const backup = await waitForJob(f, admin, '/admin/backups', (await created.json()).data.job_id);
  assert.equal(backup.status, 'SUCCEEDED');
  const download = await f.request(`/admin/backups/${backup.id}/download`, { token: admin });
  const tampered = Buffer.from(await download.arrayBuffer()); tampered[tampered.length - 1] ^= 1;
  const upload = await f.request('/admin/backups/validate', { token: admin, body: tampered, raw: true });
  assert.equal(upload.status, 202);
  const validation = await waitForJob(f, admin, '/admin/backups', (await upload.json()).data.job_id);
  assert.equal(validation.status, 'FAILED');
  assert.ok(['INVALID_BACKUP', 'CHECKSUM_MISMATCH', 'SIGNATURE_INVALID'].includes(validation.error.code));
  const databases = await f.couchCall('/_all_dbs');
  assert.equal(databases.some(name => name.startsWith('recruithub_restore_test_')), false);
  t.diagnostic('Expired JWT rejected; tampered gzip became FAILED validation before any restore target existed.');
});

test('BR-005D real backend restart marks stale jobs interrupted, consumes reservations and never resumes artifacts', {
  skip: process.env.BR005_DOCKER_INTEGRATION !== '1', timeout: 120000,
}, async t => {
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const f = await operationalFixture(t);
  const admin = await login(f, f.users.admin);
  await f.stop();
  const store = new BackupJobStore({ root: f.env.BR005_SPOOL }); await store.initialize();
  const backup = await store.create(f.users.admin._id, 'business'); backup.status = 'RUNNING'; await store.save(backup);
  await fs.writeFile(`${store.directory(backup.id)}/backup.partial`, 'incomplete');
  store.release();
  const validation = await store.create(f.users.admin._id, 'upload', { type: 'VALIDATE' });
  Object.assign(validation, { status: 'SUCCEEDED', validation_state: 'AVAILABLE' }); await store.save(validation);
  store.release();
  const restore = await store.create(f.users.admin._id, 'validated-upload', { type: 'RESTORE', validation_id: validation.id,
    target_database: `recruithub_restore_test_restart_${randomUUID().replaceAll('-', '')}` });
  store.release();
  await store.reserveValidation(validation.id, f.users.admin._id, restore.id);
  store.close();
  await f.restart();
  const interrupted = await f.request(`/admin/backups/${backup.id}`, { token: admin }); assert.equal(interrupted.status, 200);
  const interruptedData = (await interrupted.json()).data; assert.equal(interruptedData.status, 'FAILED'); assert.equal(interruptedData.error.code, 'JOB_INTERRUPTED');
  await assert.rejects(fs.stat(`${f.env.BR005_SPOOL}/${backup.id}/backup.partial`));
  const validationStatus = await f.request(`/admin/backups/${validation.id}`, { token: admin }); assert.equal(validationStatus.status, 200);
  assert.equal((await validationStatus.json()).data.validation_state, 'CONSUMED');
  const restoreStatus = await f.request(`/admin/restores/${restore.id}`, { token: admin }); assert.equal(restoreStatus.status, 200);
  const restoreData = (await restoreStatus.json()).data; assert.equal(restoreData.status, 'FAILED'); assert.equal(restoreData.error.code, 'JOB_INTERRUPTED');
  assert.equal(restoreData.result.target_incomplete, true);
  const dbs = await f.couchCall('/_all_dbs'); assert.equal(dbs.includes(restore.target_database), false);
  t.diagnostic('Real backend process restart converted RUNNING jobs to JOB_INTERRUPTED, consumed RESERVED validation, removed partial artifact and did not create/resume target.');
});

test('BR-005D concurrent restore requests reserve one validation exactly once over real HTTP', {
  skip: process.env.BR005_DOCKER_INTEGRATION !== '1', timeout: 120000,
}, async t => {
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  const f = await operationalFixture(t);
  const admin = await login(f, f.users.admin);
  const backup = await f.request('/admin/backups', { token: admin, body: { source_id: 'business' } });
  const backupData = await waitForJob(f, admin, '/admin/backups', (await backup.json()).data.job_id);
  assert.equal(backupData.status, 'SUCCEEDED');
  const file = await f.request(`/admin/backups/${backupData.id}/download`, { token: admin });
  const upload = await f.request('/admin/backups/validate', { token: admin, body: Buffer.from(await file.arrayBuffer()), raw: true });
  const validation = await waitForJob(f, admin, '/admin/backups', (await upload.json()).data.job_id);
  assert.equal(validation.validation_state, 'AVAILABLE');
  const targetOne = `recruithub_restore_test_race_${randomUUID().replaceAll('-', '')}`;
  const targetTwo = `recruithub_restore_test_race_${randomUUID().replaceAll('-', '')}`;
  const responses = await Promise.all([
    f.request('/admin/restores', { token: admin, body: { validation_id: validation.id, target_database: targetOne, confirm: true } }),
    f.request('/admin/restores', { token: admin, body: { validation_id: validation.id, target_database: targetTwo, confirm: true } }),
  ]);
  const statuses = responses.map(response => response.status).sort((a, b) => a - b);
  assert.deepEqual(statuses, [202, 409]);
  const winner = responses.find(response => response.status === 202);
  const restore = await waitForJob(f, admin, '/admin/restores', (await winner.json()).data.job_id);
  assert.equal(restore.status, 'SUCCEEDED');
  const dbs = await f.couchCall('/_all_dbs');
  assert.equal(dbs.filter(name => name === targetOne || name === targetTwo).length, 1);
  t.diagnostic('Concurrent HTTP restore submissions produced exactly one 202, one409 and one private target.');
});
