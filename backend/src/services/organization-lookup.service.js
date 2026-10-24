import { companyDocumentSchema } from '../schemas/company.schema.js';
import { departmentDocumentSchema } from '../schemas/department.schema.js';
import { getDatabaseConfig } from '../config/database.config.js';
import { CompanyRepository, DepartmentRepository } from '../repositories/organization.repository.js';
import { createCouchDbClient } from './couchdb.client.js';
import { AuthServiceError } from './auth.service.js';

export function createOrganizationDirectoryRepositories({ environment = process.env, clientFactory = createCouchDbClient } = {}) {
  const client = clientFactory({ config: getDatabaseConfig(environment) });
  return {
    companies: new CompanyRepository({ client }),
    departments: new DepartmentRepository({ client }),
  };
}

function safeCompanyDto(company) {
  return { id: company._id, name: company.name, industry: company.industry };
}

function safeDepartmentDto(department) {
  return { id: department._id, name: department.name };
}

export class OrganizationLookupService {
  constructor({ companyRepository, departmentRepository }) {
    if (!companyRepository || !departmentRepository) {
      throw new TypeError('OrganizationLookupService requires Company and Department repositories.');
    }
    this.companies = companyRepository;
    this.departments = departmentRepository;
  }

  async searchCompanies(search) {
    if (typeof search !== 'string' || search.trim().length < 2 || search.trim().length > 100) {
      throw new AuthServiceError(400, 'VALIDATION_ERROR', 'Enter between 2 and 100 characters to search for a company.');
    }
    const results = await this.companies.searchByName(search, { limit: 10 });
    return results.flatMap((document) => {
      const parsed = companyDocumentSchema.safeParse(document);
      return parsed.success ? [safeCompanyDto(parsed.data)] : [];
    });
  }

  async listDepartments(companyId) {
    let company;
    try {
      company = await this.companies.getById(companyId);
    } catch (error) {
      if (error?.code === 'NOT_FOUND') {
        throw new AuthServiceError(404, 'COMPANY_NOT_FOUND', 'The selected company is not available.');
      }
      throw error;
    }
    if (!companyDocumentSchema.safeParse(company).success) {
      throw new AuthServiceError(404, 'COMPANY_NOT_FOUND', 'The selected company is not available.');
    }

    const documents = await this.departments.listByCompanyId(companyId, { limit: 1000 });
    return documents.flatMap((document) => {
      const parsed = departmentDocumentSchema.safeParse(document);
      return parsed.success && parsed.data.company_id === companyId ? [safeDepartmentDto(parsed.data)] : [];
    }).sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  }
}
