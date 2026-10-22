/**
 * DATA-04: Lightweight Native CouchDB HTTP Client & Utilities
 * 
 * Provides pure native HTTP functions for CouchDB interactions using Node.js fetch:
 * - Environment loading with dotenv from repo root or backend/.env
 * - Masked URL logging to guarantee credentials never leak
 * - Server info, database existence, database creation
 * - Bulk document writes with per-document result checking and exponential backoff
 * - Document retrieval via _all_docs and content parity comparison using canonical hashing
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalHash } from '../../backend/src/utils/normalization.utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../');

/**
 * Pure zero-dependency .env parser.
 */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

/**
 * Loads CouchDB connection configuration from environment.
 * 
 * @param {Object} [overrides={}]
 * @returns {{ url: string, user: string, pass: string, database: string, authHeader: string, maskedUrl: string }}
 */
export function loadCouchDbConfig(overrides = {}) {
  const rootEnv = parseEnvFile(path.resolve(REPO_ROOT, '.env'));
  const backendEnv = parseEnvFile(path.resolve(REPO_ROOT, 'backend/.env'));
  const combinedEnv = { ...rootEnv, ...backendEnv, ...process.env };

  const rawUrl = overrides.url || combinedEnv.COUCHDB_URL || 'http://127.0.0.1:5984';
  const url = rawUrl.replace(/\/+$/, '');
  const user = overrides.user || combinedEnv.COUCHDB_USER || 'admin';
  const pass = overrides.pass || combinedEnv.COUCHDB_PASSWORD || '';
  const database = overrides.database || combinedEnv.COUCHDB_DATABASE || 'recruitment_db';

  const authHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

  // URL with credentials masked for safe logging
  let maskedUrl;
  try {
    const parsed = new URL(url);
    maskedUrl = `${parsed.protocol}//${user}:***@${parsed.host}/${database}`;
  } catch (_) {
    maskedUrl = `${url}/${database} (credentials masked)`;
  }

  return {
    url,
    user,
    pass,
    database,
    authHeader,
    maskedUrl,
  };
}

/**
 * Checks connection to the CouchDB server.
 * 
 * @param {Object} config
 * @returns {Promise<{ ok: boolean, version: string, uuid: string }>}
 */
export async function checkServerConnection(config) {
  const endpoint = `${config.url}/`;
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: config.authHeader,
      },
    });

    if (!res.ok) {
      throw new Error(`CouchDB returned HTTP status ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      ok: true,
      version: data.version,
      uuid: data.uuid,
    };
  } catch (err) {
    throw new Error(`Failed to connect to CouchDB at ${config.url}: ${err.message}`);
  }
}

/**
 * Fetches database metadata.
 * 
 * @param {Object} config 
 * @param {string} [dbName]
 * @returns {Promise<{ exists: boolean, info?: Object }>}
 */
export async function getDatabaseInfo(config, dbName = config.database) {
  const endpoint = `${config.url}/${encodeURIComponent(dbName)}`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: config.authHeader,
    },
  });

  if (res.status === 404) {
    return { exists: false };
  }

  if (!res.ok) {
    throw new Error(`Failed to get database info for "${dbName}": HTTP ${res.status} ${res.statusText}`);
  }

  const info = await res.json();
  return {
    exists: true,
    info,
  };
}

/**
 * Creates a database if not existing.
 * 
 * @param {Object} config 
 * @param {string} [dbName]
 * @returns {Promise<{ ok: boolean, created: boolean }>}
 */
export async function createDatabase(config, dbName = config.database) {
  const endpoint = `${config.url}/${encodeURIComponent(dbName)}`;
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      Authorization: config.authHeader,
    },
  });

  if (res.status === 201) {
    return { ok: true, created: true };
  }

  if (res.status === 412) {
    // Database already exists
    return { ok: true, created: false };
  }

  const errData = await res.json().catch(() => ({}));
  throw new Error(`Failed to create database "${dbName}": HTTP ${res.status} ${errData.reason || res.statusText}`);
}

/**
 * Sends a bulk document payload to CouchDB with retry support.
 * 
 * @param {Object} config 
 * @param {string} dbName 
 * @param {Array<Object>} docs 
 * @param {Object} [options={}]
 * @returns {Promise<Array<{ ok?: boolean, id: string, rev?: string, error?: string, reason?: string }>>}
 */
export async function bulkDocsWithRetry(config, dbName, docs, options = {}) {
  const endpoint = `${config.url}/${encodeURIComponent(dbName)}/_bulk_docs`;
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 30000;

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: config.authHeader,
        },
        body: JSON.stringify({ docs }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status >= 500 && attempt <= maxRetries) {
        const delay = Math.floor(500 * Math.pow(2, attempt - 1) + Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`_bulk_docs HTTP ${res.status}: ${errData.reason || res.statusText}`);
      }

      const results = await res.json();
      if (!Array.isArray(results)) {
        throw new Error(`Expected array from _bulk_docs, received: ${typeof results}`);
      }

      return results;
    } catch (err) {
      clearTimeout(timer);

      if (attempt > maxRetries) {
        throw new Error(`_bulk_docs failed after ${maxRetries} retries: ${err.message}`);
      }

      // Retry on network errors or timeouts
      const delay = Math.floor(500 * Math.pow(2, attempt - 1) + Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error(`_bulk_docs reached unreachable code branch`);
}

/**
 * Fetches documents by an array of IDs.
 * 
 * @param {Object} config 
 * @param {string} dbName 
 * @param {string[]} ids 
 * @returns {Promise<Map<string, Object>>} Map(id -> doc)
 */
export async function fetchDocsByIds(config, dbName, ids) {
  const endpoint = `${config.url}/${encodeURIComponent(dbName)}/_all_docs?include_docs=true`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: config.authHeader,
    },
    body: JSON.stringify({ keys: ids }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch documents by keys: HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const docMap = new Map();

  if (Array.isArray(data.rows)) {
    for (const row of data.rows) {
      if (row.doc && !row.error) {
        docMap.set(row.id, row.doc);
      }
    }
  }

  return docMap;
}

/**
 * Compares source document against CouchDB document for content parity.
 * Strips CouchDB-managed fields (_rev) before comparison.
 * 
 * @param {Object} sourceDoc 
 * @param {Object} targetDoc 
 * @returns {boolean}
 */
export function compareDocContent(sourceDoc, targetDoc) {
  if (!sourceDoc || !targetDoc) return false;

  const cleanSource = { ...sourceDoc };
  delete cleanSource._rev;

  const cleanTarget = { ...targetDoc };
  delete cleanTarget._rev;

  return canonicalHash(cleanSource) === canonicalHash(cleanTarget);
}
