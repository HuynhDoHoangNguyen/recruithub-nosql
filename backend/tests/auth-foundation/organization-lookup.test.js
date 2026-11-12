import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createOrganizationLookupRouter } from '../../src/routes/organization-lookup.routes.js';
import { OrganizationLookupService } from '../../src/services/organization-lookup.service.js';

const timestamp = '2026-10-01T00:00:00.000Z';
const company = {
  _id: 'company:existing-acme', type: 'company', name: 'Acme Technology', industry: 'Technology',
  created_at: timestamp, updated_at: timestamp,
  provenance: { classification: 'source', source_dataset: 'approved-company-directory' },
};
const department = {
  _id: 'department:existing-engineering', type: 'department', company_id: company._id,
  name: 'Engineering', key: 'engineering', created_at: timestamp, updated_at: timestamp,
  provenance: { classification: 'source', source_dataset: 'approved-company-directory' },
};

function startLookupServer(t) {
  const service = new OrganizationLookupService({
    companyRepository: {
      async searchByName(query) { return company.name.toLowerCase().includes(query.toLowerCase()) ? [company] : []; },
      async getById(id) { if (id !== company._id) { const error = new Error('missing'); error.code = 'NOT_FOUND'; throw error; } return company; },
    },
    departmentRepository: {
      async listByCompanyId(companyId) { return companyId === company._id ? [department] : []; },
    },
  });
  const app = express();
  app.use('/api/v1/companies', createOrganizationLookupRouter({ serviceFactory: () => service, enabled: true }));
  const server = app.listen(0);
  t.after(() => server.close());
  return new Promise(resolve => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}/api/v1/companies`)));
}

test('registration lookup returns existing companies and only their departments', async t => {
  const base = await startLookupServer(t);
  const companiesResponse = await fetch(`${base}?search=acme`);
  assert.equal(companiesResponse.status, 200);
  const companies = (await companiesResponse.json()).data.items;
  assert.deepEqual(companies, [{ id: company._id, name: company.name, industry: company.industry }]);

  const departmentsResponse = await fetch(`${base}/${encodeURIComponent(company._id)}/departments`);
  assert.equal(departmentsResponse.status, 200);
  assert.deepEqual((await departmentsResponse.json()).data.items, [{ id: department._id, name: department.name }]);
});

test('registration lookup rejects short search and unknown company IDs', async t => {
  const base = await startLookupServer(t);
  assert.equal((await fetch(`${base}?search=a`)).status, 400);
  const missing = await fetch(`${base}/company%3Amissing/departments`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'COMPANY_NOT_FOUND');
});
