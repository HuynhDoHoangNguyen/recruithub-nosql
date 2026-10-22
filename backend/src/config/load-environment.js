import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(moduleDirectory, '../..');
const repositoryRoot = path.resolve(backendDirectory, '..');

function parseIfPresent(filePath) {
  try {
    return dotenv.parse(fs.readFileSync(filePath));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * Load backend/.env first, then repository-root .env, without replacing values
 * already provided by the parent process. Existing files are read only.
 */
export function loadBackendEnvironment({
  env = process.env,
  backendDir = backendDirectory,
  rootDir = repositoryRoot,
} = {}) {
  const sources = [
    parseIfPresent(path.join(backendDir, '.env')),
    parseIfPresent(path.join(rootDir, '.env')),
  ];

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (env[key] === undefined) env[key] = value;
    }
  }

  return env;
}
