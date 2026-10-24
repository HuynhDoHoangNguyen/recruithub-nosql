import argon2 from 'argon2';
import { PROVENANCE_CLASSIFICATIONS, USER_ACCOUNT_STATUSES, USER_ROLES } from '../constants/document.constants.js';
import { candidateDocumentSchema } from '../schemas/candidate.schema.js';
import { userDocumentSchema } from '../schemas/user.schema.js';
import { companyDocumentSchema } from '../schemas/company.schema.js';
import { departmentDocumentSchema } from '../schemas/department.schema.js';
import { recruiterDocumentSchema, validateRecruiterOrganizationScope } from '../schemas/recruiter.schema.js';
import { candidateIdFromUserId, userIdFromEmail, normalizeEmail } from '../utils/id.utils.js';
import {
  recruiterIdFromSelfRegistration,
} from '../utils/recruiter-registration-id.utils.js';
import { toSafeUserDto } from './user.dto.js';
import { issueAccessToken, verifyAccessToken } from './jwt-access-token.js';

export { toSafeUserDto };

export const PASSWORD_HASH_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});

export class AuthServiceError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'AuthServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class AuthService {
  constructor({ userRepository, candidateRepository, companyRepository, departmentRepository, recruiterRepository, jwtSecret, now = () => Date.now() }) {
    if (!userRepository || !candidateRepository) {
      throw new TypeError('AuthService requires User and Candidate repositories.');
    }
    if (
      typeof jwtSecret !== 'string' ||
      Buffer.byteLength(jwtSecret, 'utf8') < 32 ||
      /^(replace_with|change_me|your[-_])/i.test(jwtSecret)
    ) {
      throw new AuthServiceError(503, 'AUTH_CONFIGURATION_ERROR', 'Authentication is not configured.');
    }
    this.users = userRepository;
    this.candidates = candidateRepository;
    this.companies = companyRepository;
    this.departments = departmentRepository;
    this.recruiters = recruiterRepository;
    this.jwtSecret = jwtSecret;
    this.now = now;
  }

  async register(input) {
    const email = input.email.trim();
    const emailNormalized = normalizeEmail(email);
    const userId = userIdFromEmail(emailNormalized);
    const candidateId = candidateIdFromUserId(userId);

    const existing = await this.#getExistingUser(emailNormalized);
    if (existing) {
      throw new AuthServiceError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
    }

    const timestamp = new Date(this.now()).toISOString();
    const passwordHash = await argon2.hash(input.password, PASSWORD_HASH_OPTIONS);
    const userDocument = {
      _id: userId,
      type: 'user',
      email,
      email_normalized: emailNormalized,
      password_hash: passwordHash,
      role: USER_ROLES.CANDIDATE,
      // Stage the new account as inactive until its required Candidate document exists.
      account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
      created_at: timestamp,
      updated_at: timestamp,
    };

    let userCreateResult;
    try {
      userCreateResult = await this.users.create(userDocument);
    } catch (error) {
      if (error?.code === 'CONFLICT') {
        throw new AuthServiceError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
      }
      throw error;
    }

    const candidateDocument = {
      _id: candidateId,
      type: 'candidate',
      user_id: userId,
      profile: {
        full_name: input.full_name,
        role: input.candidate_role,
        industry: input.industry,
        seniority: input.seniority,
        years_experience: input.years_experience,
        experience_months: input.years_experience * 12,
      },
      skills: [],
      education: [],
      experience: [],
      projects: [],
      data_availability: {
        skills: 'UNAVAILABLE',
        experience: 'PARTIAL',
        education: 'UNAVAILABLE',
        projects: 'UNAVAILABLE',
      },
      created_at: timestamp,
      updated_at: timestamp,
      provenance: {
        classification: PROVENANCE_CLASSIFICATIONS.MIXED,
        field_origins: {
          'profile.full_name': 'candidate_self_registration',
          'profile.role': 'candidate_self_registration',
          'profile.industry': 'candidate_self_registration',
          'profile.seniority': 'candidate_self_registration',
          'profile.years_experience': 'candidate_self_registration',
          'profile.experience_months': 'derived',
        },
      },
    };

    const parsedCandidate = candidateDocumentSchema.safeParse(candidateDocument);
    if (!parsedCandidate.success) {
      // This should only indicate a programmer/contract error; do not activate the User.
      throw new AuthServiceError(500, 'REGISTRATION_INCOMPLETE', 'The account was staged but profile creation did not complete.');
    }

    try {
      await this.candidates.create(parsedCandidate.data);
    } catch (error) {
      const status = error?.code === 'CONFLICT' ? 409 : 503;
      throw new AuthServiceError(status, 'REGISTRATION_INCOMPLETE', 'The account was staged but profile creation did not complete. Please contact support.');
    }

    const activeUser = {
      ...userDocument,
      ...(userCreateResult?.rev ? { _rev: userCreateResult.rev } : {}),
      account_status: USER_ACCOUNT_STATUSES.ACTIVE,
      updated_at: new Date(this.now()).toISOString(),
    };
    try {
      await this.users.update(activeUser, userCreateResult?.rev);
    } catch (error) {
      // On a revision conflict, leave the staged User untouched for reconciliation.
      const status = error?.code === 'CONFLICT' ? 409 : 503;
      throw new AuthServiceError(status, 'REGISTRATION_INCOMPLETE', 'The account was staged but activation did not complete. Please contact support.');
    }

    return { user: toSafeUserDto(activeUser) };
  }

  /** Register against existing Company/Department documents only. */
  async registerRecruiter(input) {
    if (!this.companies || !this.departments || !this.recruiters) {
      throw new AuthServiceError(503, 'RECRUITER_REGISTRATION_UNAVAILABLE', 'Recruiter registration storage is not configured.');
    }

    const email = input.email.trim();
    const emailNormalized = normalizeEmail(email);
    const userId = userIdFromEmail(emailNormalized);
    if (await this.#getExistingUser(emailNormalized)) {
      throw new AuthServiceError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
    }

    const companyId = input.company_id;
    const departmentId = input.department_id;
    let company;
    let department;
    try {
      [company, department] = await Promise.all([
        this.companies.getById(companyId),
        this.departments.getById(departmentId),
      ]);
    } catch (error) {
      if (error?.code === 'NOT_FOUND') {
        throw new AuthServiceError(400, 'ORGANIZATION_NOT_SUPPORTED', 'The selected company or department is no longer available. Search again or contact an administrator.');
      }
      throw error;
    }
    const parsedCompany = companyDocumentSchema.safeParse(company);
    const parsedDepartment = departmentDocumentSchema.safeParse(department);
    if (!parsedCompany.success || !parsedDepartment.success || parsedDepartment.data.company_id !== companyId) {
      throw new AuthServiceError(400, 'ORGANIZATION_NOT_SUPPORTED', 'The selected department does not belong to the selected company.');
    }
    company = parsedCompany.data;
    department = parsedDepartment.data;
    const recruiterId = recruiterIdFromSelfRegistration(userId, companyId, departmentId);

    const timestamp = new Date(this.now()).toISOString();
    const passwordHash = await argon2.hash(input.password, PASSWORD_HASH_OPTIONS);
    const userDocument = {
      _id: userId, type: 'user', email, email_normalized: emailNormalized,
      password_hash: passwordHash, role: USER_ROLES.RECRUITER,
      account_status: USER_ACCOUNT_STATUSES.RESET_REQUIRED,
      created_at: timestamp, updated_at: timestamp,
    };
    const recruiterDocument = {
      _id: recruiterId, type: 'recruiter', user_id: userId, company_id: companyId,
      department_id: departmentId, created_at: timestamp, updated_at: timestamp,
      provenance: { classification: PROVENANCE_CLASSIFICATIONS.MIXED, field_origins: {
        user_id: 'derived', company_id: 'derived', department_id: 'derived',
      } },
    };

    const documents = [
      [userDocument, userDocumentSchema],
      [recruiterDocument, recruiterDocumentSchema],
    ];
    for (const [document, schema] of documents) {
      const parsed = schema.safeParse(document);
      if (!parsed.success) {
        throw new AuthServiceError(500, 'REGISTRATION_CONFIGURATION_ERROR', 'Recruiter registration data does not satisfy the current document contract.');
      }
    }
    const scope = validateRecruiterOrganizationScope({
      recruiter: recruiterDocument, company, department, user: { ...userDocument, account_status: USER_ACCOUNT_STATUSES.ACTIVE },
    });
    if (!scope.valid) {
      throw new AuthServiceError(500, 'REGISTRATION_CONFIGURATION_ERROR', 'Recruiter registration references are inconsistent.');
    }

    let userCreateResult;
    try {
      userCreateResult = await this.users.create(userDocument);
    } catch (error) {
      if (error?.code === 'CONFLICT') {
        throw new AuthServiceError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
      }
      throw error;
    }

    try {
      await this.recruiters.create(recruiterDocument);
    } catch (error) {
      throw new AuthServiceError(error?.code === 'CONFLICT' ? 409 : 503, 'REGISTRATION_INCOMPLETE',
        'Registration did not finish. Contact an operator with the reference below; do not retry automatically.',
        { registration_ref: userId, possibly_created_document_ids: [userId, recruiterId] });
    }

    const activeUser = {
      ...userDocument,
      ...(userCreateResult?.rev ? { _rev: userCreateResult.rev } : {}),
      account_status: USER_ACCOUNT_STATUSES.ACTIVE,
      updated_at: new Date(this.now()).toISOString(),
    };
    try {
      await this.users.update(activeUser, userCreateResult?.rev);
    } catch (error) {
      throw new AuthServiceError(error?.code === 'CONFLICT' ? 409 : 503, 'REGISTRATION_INCOMPLETE',
        'Recruiter profile was created but account activation did not finish. Contact an operator; do not retry automatically.',
        { registration_ref: userId, possibly_created_document_ids: [userId, recruiterId] });
    }

    try {
      await this.#assertRecruiterReady(activeUser);
    } catch {
      throw new AuthServiceError(503, 'REGISTRATION_INCOMPLETE',
        'Registration was written but the Recruiter relationship could not be verified. Contact an operator.',
        { registration_ref: userId, possibly_created_document_ids: [userId, recruiterId] });
    }
    return { user: toSafeUserDto(activeUser) };
  }

  async login({ email, password }) {
    let user;
    try {
      user = await this.#getExistingUser(email);
    } catch (error) {
      if (error?.code !== 'NOT_FOUND') throw error;
      user = null;
    }
    if (!user || user.account_status !== USER_ACCOUNT_STATUSES.ACTIVE || !user.password_hash) {
      throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Email or password is incorrect.');
    }

    let verified = false;
    try {
      verified = await argon2.verify(user.password_hash, password);
    } catch {
      verified = false;
    }
    if (!verified) {
      throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'Email or password is incorrect.');
    }

    await this.#assertRecruiterReady(user);

    const accessToken = issueAccessToken({
      sub: user._id,
      role: user.role,
    }, { secret: this.jwtSecret, nowMs: this.now() });

    return { accessToken, user: toSafeUserDto(user) };
  }

  async authenticate(token) {
    let claims;
    try {
      claims = verifyAccessToken(token, { secret: this.jwtSecret, nowMs: this.now() });
    } catch {
      throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'A valid access token is required.');
    }

    let user;
    try {
      user = await this.users.getById(claims.sub);
    } catch (error) {
      if (error?.code === 'NOT_FOUND') {
        throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'A valid access token is required.');
      }
      throw error;
    }
    if (user.account_status !== USER_ACCOUNT_STATUSES.ACTIVE) {
      throw new AuthServiceError(401, 'AUTHENTICATION_FAILED', 'A valid access token is required.');
    }

    await this.#assertRecruiterReady(user);

    return {
      user: toSafeUserDto(user),
      principal: { sub: user._id, role: user.role },
    };
  }

  async #getExistingUser(email) {
    try {
      return await this.users.getByEmail(normalizeEmail(email));
    } catch (error) {
      if (error?.code === 'NOT_FOUND') return null;
      throw error;
    }
  }

  async #assertRecruiterReady(user) {
    if (user.role !== USER_ROLES.RECRUITER) return;
    if (!this.recruiters || !this.companies || !this.departments) {
      throw new AuthServiceError(503, 'RECRUITER_PROFILE_UNAVAILABLE', 'Recruiter profile storage is unavailable.');
    }
    try {
      const result = await this.recruiters.findByUserId(user._id);
      if (result.docs?.length !== 1) throw new Error('Recruiter profile is missing or ambiguous.');
      const recruiter = result.docs[0];
      const [company, department] = await Promise.all([
        this.companies.getById(recruiter.company_id), this.departments.getById(recruiter.department_id),
      ]);
      if (!validateRecruiterOrganizationScope({ recruiter, company, department, user }).valid) {
        throw new Error('Recruiter organization references are inconsistent.');
      }
    } catch (error) {
      if (error instanceof AuthServiceError) throw error;
      if (['NOT_FOUND', 'CONFLICT', 'DOCUMENT_VALIDATION_FAILED'].includes(error?.code) || error?.message?.includes('Recruiter profile') || error?.message?.includes('Recruiter organization')) {
        throw new AuthServiceError(403, 'RECRUITER_PROFILE_INCOMPLETE', 'Recruiter profile is incomplete or inconsistent. Contact an operator.');
      }
      throw error;
    }
  }
}
