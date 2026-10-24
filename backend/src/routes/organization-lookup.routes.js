import { Router } from 'express';
import { z } from 'zod';
import { createOrganizationDirectoryRepositories, OrganizationLookupService } from '../services/organization-lookup.service.js';
import { errorResponse, successResponse } from '../utils/api-response.js';
import { sendApiError } from '../utils/send-api-error.js';

const companySearchSchema = z.object({ search: z.string().trim().min(2).max(100) }).strict();
const companyParamsSchema = z.object({ companyId: z.string().regex(/^company:[a-z0-9_:-]+$/) }).strict();

function createDefaultService() {
  const repositories = createOrganizationDirectoryRepositories();
  return new OrganizationLookupService({
    companyRepository: repositories.companies,
    departmentRepository: repositories.departments,
  });
}

export function createOrganizationLookupRouter({
  serviceFactory = createDefaultService,
  enabled = process.env.PUBLIC_RECRUITER_REGISTRATION_ENABLED === 'true',
} = {}) {
  const router = Router();
  let service;
  const getService = () => (service ??= serviceFactory());
  const gate = (req, res, next) => enabled
    ? next()
    : res.status(404).json(errorResponse('RECRUITER_REGISTRATION_DISABLED', 'Recruiter registration is not enabled.', null));

  router.get('/', gate, async (req, res) => {
    const parsed = companySearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Enter at least 2 characters to search for a company.', null));
    }
    try {
      const companies = await getService().searchCompanies(parsed.data.search);
      return res.json(successResponse({ items: companies }, 'Companies loaded.'));
    } catch (error) { return sendApiError(res, error); }
  });

  router.get('/:companyId/departments', gate, async (req, res) => {
    const parsed = companyParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Company ID is invalid.', null));
    }
    try {
      const departments = await getService().listDepartments(parsed.data.companyId);
      return res.json(successResponse({ items: departments }, 'Departments loaded.'));
    } catch (error) { return sendApiError(res, error); }
  });

  return router;
}

export default createOrganizationLookupRouter;
