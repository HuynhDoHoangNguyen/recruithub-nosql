import { USER_ACCOUNT_STATUSES, USER_ROLES, JOB_STATUSES } from '../constants/document.constants.js';
import { AuthServiceError } from '../services/auth.service.js';
import { CouchDbError } from '../services/couchdb.errors.js';

export const ADMIN_USER_STATISTICS_DESIGN = Object.freeze({
  _id: '_design/tv1_admin_statistics',
  language: 'javascript',
  views: Object.freeze({
    user_count_by_role: Object.freeze({
      map: 'function (doc) { if (doc.type === "user" && doc.role) emit(doc.role, 1); }',
      reduce: '_count',
    }),
    user_count_by_status: Object.freeze({
      map: 'function (doc) { if (doc.type === "user" && doc.account_status) emit(doc.account_status, 1); }',
      reduce: '_count',
    }),
    user_total: Object.freeze({
      map: 'function (doc) { if (doc.type === "user") emit(null, 1); }',
      reduce: '_count',
    }),
    candidate_total: Object.freeze({
      map: 'function (doc) { if (doc.type === "candidate") emit(null, 1); }',
      reduce: '_count',
    }),
  }),
});

function viewRows(result, name) {
  if (!result || !Array.isArray(result.rows)) {
    throw new AuthServiceError(503, 'STATISTICS_QUERY_FAILED', `CouchDB view ${name} returned an invalid result.`);
  }
  return result.rows;
}

function groupedCounts(rows, allowedKeys, name) {
  const counts = Object.fromEntries(allowedKeys.map((key) => [key, 0]));
  for (const row of rows) {
    if (!allowedKeys.includes(row.key) || !Number.isSafeInteger(row.value) || row.value < 0) {
      throw new AuthServiceError(503, 'STATISTICS_QUERY_FAILED', `CouchDB view ${name} returned invalid aggregate rows.`);
    }
    counts[row.key] += row.value;
  }
  return counts;
}

function scalarCount(rows, name) {
  if (rows.length === 0) return 0;
  if (rows.length !== 1 || !Number.isSafeInteger(rows[0].value) || rows[0].value < 0) {
    throw new AuthServiceError(503, 'STATISTICS_QUERY_FAILED', `CouchDB view ${name} returned an invalid count.`);
  }
  return rows[0].value;
}

function mapMissingView(error) {
  if (error instanceof CouchDbError && error.code === 'NOT_FOUND') {
    throw new AuthServiceError(503, 'STATISTICS_VIEW_NOT_INSTALLED', 'Admin statistics views are not installed in the configured databases. Deploy the approved design documents to isolated databases before enabling this endpoint.');
  }
  throw error;
}

/** Read-only aggregate access. It never creates or updates a design document. */
export class AdminStatisticsRepository {
  constructor({ usersClient, jobsClient }) {
    if (!usersClient || typeof usersClient.queryView !== 'function' || typeof usersClient.getDatabaseInfo !== 'function' ||
        !jobsClient || typeof jobsClient.queryView !== 'function' || typeof jobsClient.getDatabaseInfo !== 'function') {
      throw new TypeError('AdminStatisticsRepository requires CouchDB clients with queryView() and getDatabaseInfo().');
    }
    this.users = usersClient;
    this.jobs = jobsClient;
  }

  async getStatistics() {
    try {
      // Distinguish a missing database (configuration/deployment error) from a missing view.
      await Promise.all([this.users.getDatabaseInfo(), this.jobs.getDatabaseInfo()]);
      const [roleRows, statusRows, totalRows, candidateRows, jobRows] = await Promise.all([
        this.users.queryView('tv1_admin_statistics', 'user_count_by_role', { group: true }),
        this.users.queryView('tv1_admin_statistics', 'user_count_by_status', { group: true }),
        this.users.queryView('tv1_admin_statistics', 'user_total'),
        this.users.queryView('tv1_admin_statistics', 'candidate_total'),
        // Reuse TV2's existing composite-key view; aggregate recruiter/status groups here.
        this.jobs.queryView('job_application', 'jobs_by_recruiter', { group_level: 2 }),
      ]);

      const roles = groupedCounts(viewRows(roleRows, 'user_count_by_role'), Object.values(USER_ROLES), 'user_count_by_role');
      const statuses = groupedCounts(viewRows(statusRows, 'user_count_by_status'), Object.values(USER_ACCOUNT_STATUSES), 'user_count_by_status');
      const jobsByStatus = Object.fromEntries(Object.values(JOB_STATUSES).map((status) => [status, 0]));
      for (const row of viewRows(jobRows, 'jobs_by_recruiter')) {
        if (!Array.isArray(row.key) || row.key.length !== 2 || typeof row.key[0] !== 'string' ||
            !Object.hasOwn(jobsByStatus, row.key[1]) || !Number.isSafeInteger(row.value) || row.value < 0) {
          throw new AuthServiceError(503, 'STATISTICS_QUERY_FAILED', 'CouchDB jobs_by_recruiter view returned invalid grouped rows.');
        }
        jobsByStatus[row.key[1]] += row.value;
      }

      return {
        source: 'couchdb_mapreduce',
        totalUsers: scalarCount(viewRows(totalRows, 'user_total'), 'user_total'),
        totalCandidates: scalarCount(viewRows(candidateRows, 'candidate_total'), 'candidate_total'),
        roles,
        statuses,
        jobs: { total: Object.values(jobsByStatus).reduce((sum, count) => sum + count, 0), statuses: jobsByStatus },
      };
    } catch (error) {
      return mapMissingView(error);
    }
  }
}
