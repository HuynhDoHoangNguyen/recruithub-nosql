import { BaseRepository } from './base.repository.js';
import { companyDocumentSchema } from '../schemas/company.schema.js';
import { departmentDocumentSchema } from '../schemas/department.schema.js';
import { recruiterDocumentSchema } from '../schemas/recruiter.schema.js';
import { DOCUMENT_TYPES } from '../constants/document.constants.js';

export class CompanyRepository extends BaseRepository {
  constructor({ client } = {}) { super({ client, schema: companyDocumentSchema }); }

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
}

export class RecruiterRepository extends BaseRepository {
  constructor({ client } = {}) { super({ client, schema: recruiterDocumentSchema }); }

  findByUserId(userId) {
    return this.find({ type: DOCUMENT_TYPES.RECRUITER, user_id: userId }, { limit: 2 });
  }
}
