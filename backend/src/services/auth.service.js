import argon2 from 'argon2';
import { PROVENANCE_CLASSIFICATIONS, USER_ACCOUNT_STATUSES, USER_ROLES } from '../constants/document.constants.js';
import { candidateDocumentSchema } from '../schemas/candidate.schema.js';
import { candidateIdFromUserId, userIdFromEmail, normalizeEmail } from '../utils/id.utils.js';
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
  constructor(status, code, message) {
    super(message);
    this.name = 'AuthServiceError';
    this.status = status;
    this.code = code;
  }
}

export class AuthService {
  constructor({ userRepository, candidateRepository, jwtSecret, now = () => Date.now() }) {
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
}
