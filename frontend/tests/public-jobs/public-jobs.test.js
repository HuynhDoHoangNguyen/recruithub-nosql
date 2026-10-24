import test from 'node:test';
import assert from 'node:assert/strict';
import { publicJobFixtures } from '../../src/mocks/publicJobs.js';
import { filterSortAndPageJobs, findOpenJob } from '../../src/services/publicJobsModel.js';

test('public job model exposes OPEN jobs and filters by search, industry and seniority', () => {
  const result = filterSortAndPageJobs(publicJobFixtures, { search: 'react', industry: 'Technology', seniority: 'MID' });
  assert.equal(result.total, 1);
  assert.equal(result.jobs[0].title, 'Frontend Engineer');
  assert.equal(result.jobs[0].status, 'OPEN');
});

test('public job model sorts deterministically and paginates fixtures', () => {
  const first = filterSortAndPageJobs(publicJobFixtures, { sort: 'title', page: 1, pageSize: 2 });
  const second = filterSortAndPageJobs(publicJobFixtures, { sort: 'title', page: 2, pageSize: 2 });
  assert.deepEqual(first.jobs.map((job) => job.title), ['Backend Engineer', 'Data Analyst']);
  assert.equal(first.nextPage, 2);
  assert.equal(second.jobs.length, 2);
  assert.equal(second.nextPage, null);
});

test('job detail lookup does not expose closed jobs', () => {
  assert.equal(findOpenJob(publicJobFixtures, 'job:demo:frontend-engineer')?.status, 'OPEN');
  assert.equal(findOpenJob([...publicJobFixtures, { ...publicJobFixtures[0], id: 'job:demo:closed', status: 'CLOSED' }], 'job:demo:closed'), null);
});
