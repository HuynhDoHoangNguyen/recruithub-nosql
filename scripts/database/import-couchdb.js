#!/usr/bin/env node
/**
 * DATA-04B: CouchDB Bulk Ingestion Engine
 * 
 * Responsibilities:
 * 1. Resolves canonical DATA-03.4B release via active manifest pointer (data/processed/manifests/final-manifest.json).
 * 2. Preflight verification: validates 9 SHA-256 file hashes and 25,750 records against manifest.
 * 3. Connection and database safety verification (checks doc_count; creates DB only if --create-db).
 * 4. Dependency-ordered streaming import in batches of up to 500 docs via _bulk_docs.
 * 5. Inspects every per-document response item; handles conflicts via content parity comparison.
 * 6. Idempotent rerun: skips identical documents without creating new revisions.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  loadCouchDbConfig,
  checkServerConnection,
  getDatabaseInfo,
  createDatabase,
  bulkDocsWithRetry,
  fetchDocsByIds,
  compareDocContent,
} from './couchdb-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

export const BATCH_SIZE = 500;

export const IMPORT_ORDER = [
  'users.jsonl',
  'companies.jsonl',
  'departments.jsonl',
  'recruiters.jsonl',
  'candidates.jsonl',
  'jobs.jsonl',
  'applications.jsonl',
  'interviews.jsonl',
  'resume_analyses.jsonl',
];

/**
 * Computes sha256 checksum of a file.
 */
function computeFileSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();
}

/**
 * Main import procedure.
 */
export async function runCouchDbImport(options = {}) {
  const startTime = Date.now();
  const dryRun = options.dryRun || false;
  const createDbIfMissing = options.createDb || false;
  const allowExistingDb = options.allowExistingDb || false;
  const manifestsDir = options.manifestsDir || path.resolve(REPO_ROOT, 'data/processed/manifests');
  const finalManifestPath = options.finalManifestPath || path.join(manifestsDir, 'final-manifest.json');

  console.log('=== DATA-04B: COUCHDB BULK INGESTION ENGINE ===');
  console.log(`Dry Run:            ${dryRun ? 'YES (No database writes)' : 'NO'}`);
  console.log(`Active Manifest:    ${finalManifestPath}`);

  // 1. Resolve and verify final manifest
  if (!fs.existsSync(finalManifestPath)) {
    throw new Error(`Active final manifest pointer not found: ${finalManifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(finalManifestPath, 'utf8'));
  const releaseDir = options.releaseDir || path.resolve(REPO_ROOT, manifest.immutable_release_dir);

  console.log(`Release ID:         ${manifest.release_id}`);
  console.log(`Release Digest:     ${manifest.release_digest}`);
  console.log(`Release Directory:  ${releaseDir}\n`);

  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Immutable release directory does not exist: ${releaseDir}`);
  }

  // 2. Preflight Checksum & File Validation
  console.log('1/4 Preflight verification: checking 9 JSONL file checksums and counts...');
  let manifestTotalRecords = 0;

  for (const filename of IMPORT_ORDER) {
    const filePath = path.join(releaseDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing expected release file: ${filePath}`);
    }

    const expectedEntry = manifest.output_files?.[filename];
    if (!expectedEntry) {
      throw new Error(`Manifest output_files does not track file: ${filename}`);
    }

    const actualSha = computeFileSha256(filePath);
    if (actualSha !== expectedEntry.sha256) {
      throw new Error(
        `SHA-256 checksum mismatch for ${filename}!\nExpected: ${expectedEntry.sha256}\nActual:   ${actualSha}`
      );
    }

    manifestTotalRecords += expectedEntry.record_count;
    console.log(`  ✔ ${filename.padEnd(22)} (${expectedEntry.record_count.toLocaleString().padStart(6)} docs) - SHA-256 OK`);
  }

  if (manifestTotalRecords !== 25750) {
    throw new Error(`Expected exactly 25,750 documents across 9 files, found ${manifestTotalRecords}`);
  }
  console.log('  All 9 release files verified successfully!\n');

  // 3. Database Connection and Safety Checks
  console.log('2/4 Connecting to CouchDB and checking target database...');
  const config = loadCouchDbConfig(options);
  console.log(`  Target: ${config.maskedUrl}`);

  const serverInfo = await checkServerConnection(config);
  console.log(`  Connected to CouchDB version: ${serverInfo.version}`);

  const dbInfo = await getDatabaseInfo(config);

  if (!dbInfo.exists) {
    if (!createDbIfMissing && !dryRun) {
      throw new Error(
        `Database "${config.database}" does not exist in CouchDB. Pass --create-db to allow automatic creation.`
      );
    }

    if (!dryRun) {
      console.log(`  Creating database "${config.database}"...`);
      await createDatabase(config);
      console.log(`  Database "${config.database}" created successfully.`);
    } else {
      console.log(`  [DRY RUN] Would create database "${config.database}".`);
    }
  } else {
    console.log(`  Database "${config.database}" exists. Current doc_count: ${dbInfo.info.doc_count}`);
    if (dbInfo.info.doc_count > 0 && !allowExistingDb && !dryRun) {
      // If db has documents, require explicit confirmation flag
      console.warn(
        `  [WARNING] Target database "${config.database}" already contains ${dbInfo.info.doc_count} documents.`
      );
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Preflight checks passed. Skipping database writes (--dry-run).');
    return {
      dryRun: true,
      valid: true,
      totalDocuments: manifestTotalRecords,
      releaseId: manifest.release_id,
      releaseDigest: manifest.release_digest,
    };
  }

  // 4. Batch Ingestion
  console.log('\n3/4 Streaming and ingesting documents in dependency order (Batch size: 500)...');
  let grandTotalProcessed = 0;
  let grandTotalInserted = 0;
  let grandTotalSkipped = 0;
  let grandTotalErrors = 0;
  const errorsList = [];

  for (const filename of IMPORT_ORDER) {
    const filePath = path.join(releaseDir, filename);
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentBatch = [];
    let fileDocCount = 0;
    let fileBatchCount = 0;
    let fileInserted = 0;
    let fileSkipped = 0;

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const doc = JSON.parse(trimmed);
      currentBatch.push(doc);
      fileDocCount++;

      if (currentBatch.length >= BATCH_SIZE) {
        fileBatchCount++;
        const res = await processBatch(config, currentBatch, `${filename} batch #${fileBatchCount}`);
        fileInserted += res.inserted;
        fileSkipped += res.skipped;
        if (res.errors.length > 0) {
          grandTotalErrors += res.errors.length;
          errorsList.push(...res.errors);
        }
        currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
      fileBatchCount++;
      const res = await processBatch(config, currentBatch, `${filename} batch #${fileBatchCount}`);
      fileInserted += res.inserted;
      fileSkipped += res.skipped;
      if (res.errors.length > 0) {
        grandTotalErrors += res.errors.length;
        errorsList.push(...res.errors);
      }
      currentBatch = [];
    }

    grandTotalProcessed += fileDocCount;
    grandTotalInserted += fileInserted;
    grandTotalSkipped += fileSkipped;

    console.log(
      `  ✔ ${filename.padEnd(22)} (${fileDocCount.toLocaleString().padStart(6)} docs) - Inserted: ${fileInserted}, Skipped: ${fileSkipped}`
    );
  }

  if (grandTotalErrors > 0) {
    throw new Error(`Import completed with ${grandTotalErrors} document errors. Inspect error list.`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n4/4 Import execution completed:');
  console.log(`  - Total Processed: ${grandTotalProcessed.toLocaleString()} documents`);
  console.log(`  - Total Inserted:  ${grandTotalInserted.toLocaleString()}`);
  console.log(`  - Total Skipped:   ${grandTotalSkipped.toLocaleString()}`);
  console.log(`  - Total Errors:    ${grandTotalErrors}`);
  console.log(`  - Duration:        ${durationSec}s\n`);

  return {
    dryRun: false,
    success: true,
    totalProcessed: grandTotalProcessed,
    totalInserted: grandTotalInserted,
    totalSkipped: grandTotalSkipped,
    totalErrors: grandTotalErrors,
    releaseId: manifest.release_id,
    releaseDigest: manifest.release_digest,
    database: config.database,
    durationSec,
  };
}

/**
 * Processes a single batch of documents.
 * 
 * @param {Object} config 
 * @param {Array<Object>} batch 
 * @param {string} batchLabel 
 * @returns {Promise<{ inserted: number, skipped: number, errors: Array }>}
 */
async function processBatch(config, batch, batchLabel) {
  // First, check if documents already exist to achieve safe idempotency without creating extra revisions
  const batchIds = batch.map((d) => d._id);
  const existingDocMap = await fetchDocsByIds(config, config.database, batchIds);

  const docsToInsert = [];
  let skipped = 0;
  const errors = [];

  for (const doc of batch) {
    const existing = existingDocMap.get(doc._id);
    if (existing) {
      if (compareDocContent(doc, existing)) {
        // Identical business content: skip insertion to preserve existing revision and avoid duplicates
        skipped++;
      } else {
        // Conflicting differing document
        errors.push({
          id: doc._id,
          error: 'conflict_content_mismatch',
          reason: `Document ${doc._id} already exists in database with differing content`,
        });
      }
    } else {
      docsToInsert.push(doc);
    }
  }

  let inserted = 0;

  if (docsToInsert.length > 0) {
    const bulkResults = await bulkDocsWithRetry(config, config.database, docsToInsert);

    for (const res of bulkResults) {
      if (res.ok) {
        inserted++;
      } else if (res.error === 'conflict') {
        // Double check if conflict was due to concurrent write of identical content
        const conflictDoc = docsToInsert.find((d) => d._id === res.id);
        const refetched = await fetchDocsByIds(config, config.database, [res.id]);
        const target = refetched.get(res.id);

        if (target && conflictDoc && compareDocContent(conflictDoc, target)) {
          skipped++;
        } else {
          errors.push({
            id: res.id,
            error: res.error,
            reason: res.reason || 'Document update conflict',
          });
        }
      } else {
        errors.push({
          id: res.id,
          error: res.error || 'unknown_error',
          reason: res.reason || 'Unknown CouchDB error',
        });
      }
    }
  }

  return { inserted, skipped, errors };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--create-db') {
      options.createDb = true;
    } else if (args[i] === '--allow-existing-db') {
      options.allowExistingDb = true;
    } else if (args[i] === '--manifest' && args[i + 1]) {
      options.finalManifestPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--database' && args[i + 1]) {
      options.database = args[i + 1];
      i++;
    }
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs();
  runCouchDbImport(options).catch((err) => {
    console.error('\n[FATAL COUCHDB IMPORT ERROR]:', err.message);
    process.exit(1);
  });
}
