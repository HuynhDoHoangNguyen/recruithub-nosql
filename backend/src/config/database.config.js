import { z } from 'zod';

const databaseConfigSchema = z
  .object({
    COUCHDB_URL: z.string().url().default('http://127.0.0.1:5984'),
    COUCHDB_DATABASE: z.string().default('recruitment_db'),
    COUCHDB_USER: z.string().optional(),
    COUCHDB_PASSWORD: z.string().optional(),
    COUCHDB_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(5000),
  })
  .superRefine((value, context) => {
    const url = new URL(value.COUCHDB_URL);
    if (!['http:', 'https:'].includes(url.protocol)) {
      context.addIssue({
        code: 'custom',
        path: ['COUCHDB_URL'],
        message: 'COUCHDB_URL must use HTTP or HTTPS',
      });
    }
    if (url.username || url.password) {
      context.addIssue({
        code: 'custom',
        path: ['COUCHDB_URL'],
        message: 'Credentials must use COUCHDB_USER and COUCHDB_PASSWORD, not URL userinfo',
      });
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      context.addIssue({
        code: 'custom',
        path: ['COUCHDB_URL'],
        message: 'COUCHDB_URL must identify the server root without path, query, or fragment',
      });
    }
    if (!/^[a-z][a-z0-9_$()+/-]*$/.test(value.COUCHDB_DATABASE)) {
      context.addIssue({
        code: 'custom',
        path: ['COUCHDB_DATABASE'],
        message: 'COUCHDB_DATABASE is not a valid CouchDB database name',
      });
    }
    if (Boolean(value.COUCHDB_USER) !== Boolean(value.COUCHDB_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['COUCHDB_USER'],
        message: 'COUCHDB_USER and COUCHDB_PASSWORD must be provided together',
      });
    }
  });

export function getDatabaseConfig(environment = process.env) {
  const parsed = databaseConfigSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(({ path, message }) => `${path.join('.') || 'config'}: ${message}`)
      .join('; ');
    const error = new Error(`Invalid CouchDB configuration: ${details}`);
    error.name = 'DatabaseConfigError';
    error.code = 'INVALID_DATABASE_CONFIG';
    throw error;
  }

  const { COUCHDB_URL, COUCHDB_DATABASE, COUCHDB_USER, COUCHDB_PASSWORD, COUCHDB_TIMEOUT_MS } = parsed.data;
  return Object.freeze({
    url: COUCHDB_URL.replace(/\/$/, ''),
    database: COUCHDB_DATABASE,
    username: COUCHDB_USER,
    password: COUCHDB_PASSWORD,
    timeoutMs: COUCHDB_TIMEOUT_MS,
  });
}

export { databaseConfigSchema };
