import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BACKUP_LIMITS, backupError, backupParamsSchema } from '../models/admin-backup.schema.js';

const execute = promisify(execFile);
const activeRoots = new Set();
const windowsAcl = `
$ErrorActionPreference='Stop'
Import-Module "$PSHOME/Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1" -ErrorAction Stop
$p=$env:RECRUIHUB_BACKUP_ACL_PATH
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$old=Get-Acl -LiteralPath $p
$owner=$old.GetOwner([System.Security.Principal.SecurityIdentifier])
if($owner.Value -ne $sid.Value){throw 'Unexpected owner'}
$acl=New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true,$false)
$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($rule)
[System.IO.Directory]::SetAccessControl($p,$acl)
$verified=Get-Acl -LiteralPath $p
if(-not $verified.AreAccessRulesProtected){throw 'ACL inheritance'}
$rules=$verified.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])
if($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].FileSystemRights -ne 'FullControl'){throw 'Unsafe ACL'}
foreach($file in [System.IO.Directory]::GetFiles($p)){
  if(([System.IO.File]::GetAttributes($file) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Reparse file'}
  $fileAcl=Get-Acl -LiteralPath $file
  if($fileAcl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'File owner'}
  $fileRules=$fileAcl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])
  if($fileRules.Count -ne 1 -or $fileRules[0].IdentityReference.Value -ne $sid.Value -or $fileRules[0].AccessControlType -ne 'Allow' -or $fileRules[0].FileSystemRights -ne 'FullControl'){throw 'Unsafe file ACL'}
}
`;

export async function secureBackupDirectory(directory) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw backupError('BACKUP_CONFIGURATION_ERROR');
  if (process.platform === 'win32') {
    await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', windowsAcl], {
      windowsHide: true, timeout: 10000,
      env: { ...process.env, RECRUIHUB_BACKUP_ACL_PATH: directory },
    });
  } else {
    if (stat.uid !== process.getuid()) throw backupError('BACKUP_CONFIGURATION_ERROR');
    await fs.chmod(directory, 0o700);
    if ((await fs.stat(directory)).mode & 0o077) throw backupError('BACKUP_CONFIGURATION_ERROR');
  }
}

export class BackupJobStore {
  constructor({ root = path.join(os.tmpdir(), 'recruithub-backups-v1'), limits = BACKUP_LIMITS,
    now = () => Date.now() } = {}) {
    this.root = path.resolve(root); this.limits = limits; this.now = now;
    this.initialization = null; this.timer = null;
    this.metadataLocks = new Map();
    this.lifecycle = Promise.resolve();
  }
  directory(id) {
    if (!backupParamsSchema.safeParse({ id }).success) throw backupError('JOB_NOT_FOUND', 404);
    return path.join(this.root, id);
  }
  async safeDirectory(id) {
    const directory = this.directory(id);
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(directory) !== directory) throw backupError('BACKUP_CONFIGURATION_ERROR');
    return directory;
  }
  async initialize() {
    if (!this.initialization) this.initialization = this.startup().catch(() => {
      this.initialization = null;
      throw backupError('BACKUP_CONFIGURATION_ERROR');
    });
    return this.initialization;
  }
  async startup() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    if (await fs.realpath(this.root) !== this.root) throw backupError('BACKUP_CONFIGURATION_ERROR');
    await secureBackupDirectory(this.root);
    for (const id of await fs.readdir(this.root)) {
      if (!backupParamsSchema.safeParse({ id }).success) throw backupError('BACKUP_CONFIGURATION_ERROR');
      await this.safeDirectory(id);
      await secureBackupDirectory(this.directory(id));
      const job = await this.read(id);
      if (['RUNNING', 'QUEUED'].includes(job.status)) {
        job.status = 'FAILED'; job.error = this.publicError(backupError('JOB_INTERRUPTED'));
        if (job.type === 'RESTORE') job.result = { target_database: job.target_database, target_incomplete: true, requires_manual_configuration: true };
        await this.save(job);
        await this.removeArtifact(id, 'backup.partial');
        await this.removeArtifact(id, 'backup.rhbr.gz');
        await this.removeArtifact(id, 'upload.partial');
        await this.removeArtifact(id, 'upload.rhbr.gz');
      }
      if (job.validation_state === 'RESERVED') { job.validation_state = 'CONSUMED'; await this.save(job); }
    }
    await this.cleanup();
    this.timer = setInterval(() => this.cleanup().catch(() => { /* admission also checks quota; no raw diagnostics */ }), this.limits.cleanupInterval);
    this.timer.unref();
  }
  close() { clearInterval(this.timer); }
  publicError(error) {
    const allowed = ['BACKUP_CONFIGURATION_ERROR', 'DATABASE_UNAVAILABLE', 'SOURCE_CHANGED', 'SOURCE_CONFLICTS',
      'BACKUP_LIMIT_EXCEEDED', 'JOB_INTERRUPTED', 'JOB_TIMEOUT', 'INVALID_BACKUP', 'UNSUPPORTED_INDEX',
      'CHECKSUM_MISMATCH', 'SIGNATURE_INVALID', 'INVALID_TARGET', 'TARGET_EXISTS', 'RESTORE_SECURITY_ERROR',
      'RESTORE_VERIFICATION_FAILED', 'RESTORE_WRITE_FAILED', 'VALIDATION_USED'];
    const safe = backupError(allowed.includes(error?.code) ? error.code : 'BACKUP_CONFIGURATION_ERROR');
    return { code: safe.code, message: safe.message };
  }
  async metadataOperation(id, operation) {
    const previous = this.metadataLocks.get(id) || Promise.resolve();
    let release;
    const held = new Promise(resolve => { release = resolve; });
    this.metadataLocks.set(id, held);
    await previous;
    try { return await operation(); }
    finally { release(); if (this.metadataLocks.get(id) === held) this.metadataLocks.delete(id); }
  }
  async read(id) {
    return this.metadataOperation(id, async () => {
      try {
        const directory = await this.safeDirectory(id);
        const target = path.join(directory, 'job.json');
        const stat = await fs.lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw backupError('BACKUP_CONFIGURATION_ERROR');
        const job = JSON.parse(await fs.readFile(target, 'utf8'));
        if (job.id !== id || typeof job.owner_id !== 'string' || !Number.isFinite(Date.parse(job.expires_at))) throw backupError('BACKUP_CONFIGURATION_ERROR');
        return job;
      } catch (error) {
        if (error.code === 'ENOENT') throw backupError('JOB_NOT_FOUND', 404);
        throw error;
      }
    });
  }
  async save(job) {
    return this.metadataOperation(job.id, async () => {
      const directory = await this.safeDirectory(job.id);
      const temporary = path.join(directory, `${randomUUID()}.tmp`);
      job.updated_at = new Date(this.now()).toISOString();
      try {
        const handle = await fs.open(temporary, 'wx', 0o600);
        try { await handle.writeFile(JSON.stringify(job)); await handle.sync(); }
        finally { await handle.close(); }
        for (let attempt = 0; ; attempt++) {
          try { await fs.rename(temporary, path.join(directory, 'job.json')); break; }
          catch (error) {
            if (!['EPERM', 'EBUSY'].includes(error.code) || attempt === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
          }
        }
      } finally { await fs.unlink(temporary).catch(() => {}); }
    });
  }
  async removeArtifact(id, filename) {
    const file = path.join(await this.safeDirectory(id), filename);
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw backupError('BACKUP_CONFIGURATION_ERROR');
      await fs.unlink(file);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  async usage() {
    let size = 0, jobs = 0;
    for (const id of await fs.readdir(this.root)) {
      const directory = await this.safeDirectory(id);
      const job = await this.read(id);
      if (Date.parse(job.expires_at) > this.now()) jobs++;
      for (const name of await fs.readdir(directory)) {
        const stat = await fs.lstat(path.join(directory, name));
        if (!stat.isFile() || stat.isSymbolicLink()) throw backupError('BACKUP_CONFIGURATION_ERROR');
        size += stat.size;
      }
    }
    return { size, jobs };
  }
  async create(owner, source, { type = 'BACKUP', target_database, validation_id } = {}) {
    await this.initialize();
    if (activeRoots.has(this.root)) throw backupError('JOB_BUSY', 409);
    activeRoots.add(this.root);
    try {
      await this.cleanup();
      const usage = await this.usage(); const disk = await fs.statfs(this.root);
      if (usage.jobs >= this.limits.jobs || usage.size + this.limits.compressed + this.limits.record > this.limits.spool
        || disk.bavail * disk.bsize < this.limits.compressed + this.limits.record) throw backupError('BACKUP_LIMIT_EXCEEDED', 413);
      const id = randomUUID();
      const job = { id, owner_id: owner, source_id: source, type, status: 'QUEUED', phase: type === 'BACKUP' ? 'EXPORTING' : type === 'VALIDATE' ? 'UPLOADING' : 'CREATING',
        processed: 0, total: null, created_at: new Date(this.now()).toISOString(),
        expires_at: new Date(this.now() + this.limits.ttl).toISOString(), result: null, error: null };
      if (target_database) job.target_database = target_database;
      if (validation_id) job.validation_id = validation_id;
      await fs.mkdir(this.directory(id), { mode: 0o700 });
      await this.save(job);
      return job;
    } catch (error) { activeRoots.delete(this.root); throw error; }
  }
  release() { activeRoots.delete(this.root); }
  async lifecycleOperation(operation) {
    const previous = this.lifecycle; let release;
    this.lifecycle = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  async owned(id, owner) {
    await this.initialize();
    return this.lifecycleOperation(() => this.ownedRecord(id, owner));
  }
  async ownedRecord(id, owner) {
    const job = await this.read(id);
    if (job.owner_id !== owner) throw backupError('JOB_NOT_FOUND', 404);
    if (!['RUNNING', 'QUEUED'].includes(job.status) && job.validation_state !== 'RESERVED' && Date.parse(job.expires_at) <= this.now()) {
      await this.removeArtifact(id, 'backup.rhbr.gz'); await this.removeArtifact(id, 'backup.partial');
      await this.removeArtifact(id, 'upload.partial'); await this.removeArtifact(id, 'upload.rhbr.gz');
      job.status = 'EXPIRED'; await this.save(job);
    }
    return job;
  }
  async reserveValidation(id, owner, restoreId) {
    return this.lifecycleOperation(async () => {
      const job = await this.ownedRecord(id, owner);
      if (job.status === 'EXPIRED') throw backupError('ARTIFACT_EXPIRED', 410);
      if (job.type !== 'VALIDATE' || job.status !== 'SUCCEEDED' || job.validation_state !== 'AVAILABLE') throw backupError('VALIDATION_USED', 409);
      job.validation_state = 'RESERVED'; job.restore_id = restoreId; await this.save(job); return job;
    });
  }
  async consumeValidation(id) {
    return this.lifecycleOperation(async () => {
      const job = await this.read(id); job.validation_state = 'CONSUMED'; await this.save(job);
    });
  }
  dto(job) { const { owner_id: _owner, source_id: _source, ...dto } = job; return dto; }
  async download(id, owner) {
    const job = await this.owned(id, owner);
    if (job.type !== 'BACKUP') throw backupError('JOB_NOT_FOUND', 404);
    if (job.status === 'EXPIRED') throw backupError('ARTIFACT_EXPIRED', 410);
    if (job.status !== 'SUCCEEDED') throw backupError('ARTIFACT_NOT_READY', 409);
    const file = path.join(await this.safeDirectory(id), 'backup.rhbr.gz');
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw backupError('BACKUP_CONFIGURATION_ERROR');
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    return { stream: handle.createReadStream({ autoClose: true }), handle, size: stat.size,
      filename: `recruithub-backup-${job.created_at.replace(/[:.]/g, '-')}-${id}.rhbr.gz` };
  }
  async cleanup() {
    return this.lifecycleOperation(async () => {
    for (const id of await fs.readdir(this.root)) {
      const job = await this.read(id);
      if (['RUNNING', 'QUEUED'].includes(job.status) || job.validation_state === 'RESERVED') continue;
      if (Date.parse(job.expires_at) <= this.now()) {
        await this.removeArtifact(id, 'backup.rhbr.gz'); await this.removeArtifact(id, 'backup.partial');
        await this.removeArtifact(id, 'upload.partial'); await this.removeArtifact(id, 'upload.rhbr.gz');
        if (job.status !== 'EXPIRED') { job.status = 'EXPIRED'; await this.save(job); }
      }
      if (Date.parse(job.created_at) + this.limits.retention <= this.now()) {
        // Only known files under a verified UUID directory. Never recursive delete.
        const directory = await this.safeDirectory(id);
        const names = await fs.readdir(directory);
        if (names.some(name => name !== 'job.json')) throw backupError('BACKUP_CONFIGURATION_ERROR');
        await this.removeArtifact(id, 'job.json'); await fs.rmdir(directory);
      }
    }
    });
  }
}
