import { BaseRepository } from './base.repository.js';
import { companyDocumentSchema } from '../schemas/company.schema.js';
import { departmentDocumentSchema } from '../schemas/department.schema.js';
import { recruiterDocumentSchema } from '../schemas/recruiter.schema.js';
import { DOCUMENT_TYPES } from '../constants/document.constants.js';
import { normalizeCompanyName } from '../utils/recruiter-registration-id.utils.js';

export class CompanyRepository extends BaseRepository {
  constructor({ client } = {}) { super({ client, schema: companyDocumentSchema }); }

  async searchByName(query, { limit = 10, pageSize = 250 } = {}) {
    const normalizedQuery = normalizeCompanyName(query);
    const matches = [];
    let afterId;
    do {
      const page = await this.listByIdPrefix('company:', { afterId, limit: pageSize });
      for (const document of page.docs) {
        const parsed = companyDocumentSchema.safeParse(document);
        if (!parsed.success || parsed.data.type !== DOCUMENT_TYPES.COMPANY) continue;
        if (normalizeCompanyName(parsed.data.name).includes(normalizedQuery)) matches.push(parsed.data);
      }
      if (matches.length >= limit || !page.hasMore || !page.lastId || page.lastId === afterId) break;
      afterId = page.lastId;
    } while (true);
    return matches.slice(0, limit);
  }

  async findNameCollision(normalizedName, normalizeName) {
    let afterId;
    do {
      const page = await this.listByIdPrefix('company:', { afterId, limit: 250 });
      const collision = page.docs.find((company) => normalizeName(company.name) === normalizedName);
      if (collision) return collision;
      if (!page.hasMore || !page.lastId || page.lastId === afterId) return null;
      afterId = page.lastId;
    } while (true);
  }
}

export class DepartmentRepository extends BaseRepository {
  constructor({ client } = {}) { super({ client, schema: departmentDocumentSchema }); }

  async listByCompanyId(companyId, { limit = 1000, pageSize = 250 } = {}) {
    const departments = [];
    let afterId;
    do {
      const page = await this.listByIdPrefix('department:', { afterId, limit: pageSize });
      for (const document of page.docs) {
        if (document.type === DOCUMENT_TYPES.DEPARTMENT && document.company_id === companyId) departments.push(document);
      }
      if (!page.hasMore || !page.lastId || page.lastId === afterId || departments.length >= limit) break;
      afterId = page.lastId;
    } while (true);
    return departments.slice(0, limit);
  }
}

export class RecruiterRepository extends BaseRepository {
  constructor({ client } = {}) { super({ client, schema: recruiterDocumentSchema }); }

  findByUserId(userId) {
    return this.find({ type: DOCUMENT_TYPES.RECRUITER, user_id: userId }, { limit: 2 });
  }
}
