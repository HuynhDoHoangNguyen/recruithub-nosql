import { candidateDocumentSchema } from '../schemas/candidate.schema.js';
import { candidateProfilePatchSchema, candidateAvailabilityStates } from '../schemas/candidate-profile.schema.js';
import { AuthServiceError } from './auth.service.js';
import { resolveOwnedAsset } from './upload.service.js';
import { editedDateIssues } from '../schemas/profile-validation.schema.js';

function safeProfileDto(document) {
  return {
    profile: document.profile,
    skills: document.skills,
    education: document.education,
    experience_summary: document.experience_summary ?? null,
    experience: document.experience,
    projects: document.projects,
    languages: document.languages ?? [],
    data_availability: document.data_availability,
    ...(document.resume_file ? { resume_file: document.resume_file } : {}),
    ...(document.avatar ? { avatar: document.avatar } : {}),
  };
}

function availabilityFor(items, fallback = candidateAvailabilityStates.PARTIAL) {
  return items.length === 0 ? candidateAvailabilityStates.NONE_DECLARED : fallback;
}

export class CandidateProfileService {
  constructor({ candidateRepository, assets, now = () => Date.now() }) {
    if (!candidateRepository) throw new TypeError('CandidateProfileService requires CandidateRepository.');
    this.candidates = candidateRepository;
    this.now = now;
    this.assets = assets;
  }

  async getMyProfile(userId) {
    const { docs = [] } = await this.candidates.findByUserId(userId);
    if (docs.length === 0) throw new AuthServiceError(404, 'CANDIDATE_PROFILE_NOT_FOUND', 'Candidate profile was not found.');
    if (docs.length !== 1) throw new AuthServiceError(409, 'CANDIDATE_PROFILE_INTEGRITY_ERROR', 'Candidate profile requires operator review.');
    if (docs[0].user_id !== userId) throw new AuthServiceError(403, 'FORBIDDEN', 'You do not have permission to access this profile.');
    return { profile: safeProfileDto(docs[0]), revision: docs[0]._rev };
  }

  async updateMyProfile(userId, input, expectedRevision) {
    const parsed = candidateProfilePatchSchema.safeParse(input);
    if (!parsed.success) throw new AuthServiceError(400, 'VALIDATION_ERROR', parsed.error.issues[0].message,
      parsed.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
    const { docs = [] } = await this.candidates.findByUserId(userId);
    if (docs.length === 0) throw new AuthServiceError(404, 'CANDIDATE_PROFILE_NOT_FOUND', 'Candidate profile was not found.');
    if (docs.length !== 1) throw new AuthServiceError(409, 'CANDIDATE_PROFILE_INTEGRITY_ERROR', 'Candidate profile requires operator review.');
    const current = docs[0];
    if (current.user_id !== userId) throw new AuthServiceError(403, 'FORBIDDEN', 'You do not have permission to update this profile.');
    if (!expectedRevision || current._rev !== expectedRevision) {
      throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The profile changed. Reload it and try again.');
    }

    const patch = parsed.data;
    const dateIssues = editedDateIssues(patch, current);
    if (dateIssues.length) throw new AuthServiceError(400, 'VALIDATION_ERROR', dateIssues[0].message, dateIssues);
    const next = {
      ...current,
      profile: { ...current.profile, ...(patch.profile ?? {}) },
      ...(patch.skills ? { skills: patch.skills } : {}),
      ...(patch.education ? { education: patch.education } : {}),
      ...(patch.experience ? { experience: patch.experience } : {}),
      ...(patch.projects ? { projects: patch.projects } : {}),
      ...(patch.languages ? { languages: patch.languages } : {}),
      ...(patch.experience_summary ? { experience_summary: patch.experience_summary } : {}),
      updated_at: new Date(this.now()).toISOString(),
      provenance: {
        ...current.provenance,
        classification: current.provenance?.classification === 'unavailable' ? 'unavailable' : 'mixed',
        field_origins: { ...(current.provenance?.field_origins ?? {}) },
      },
    };
    if (patch.profile) next.provenance.field_origins['profile'] = 'candidate_self_service';
    for (const key of ['skills', 'education', 'experience', 'experience_summary', 'projects', 'languages']) {
      if (patch[key] !== undefined) next.provenance.field_origins[key] = 'candidate_self_service';
    }
    next.data_availability = { ...current.data_availability };
    for (const key of ['skills', 'education', 'experience', 'projects']) {
      if (patch[key]) next.data_availability[key] = availabilityFor(patch[key]);
    }
    if (patch.profile?.years_experience !== undefined) {
      next.profile.experience_months = patch.profile.years_experience * 12;
    }

    for (const [inputKey, storedKey, kind] of [['resume_file_id', 'resume_file', 'resume'], ['avatar_asset_id', 'avatar', 'avatar']]) {
      if (patch[inputKey] === undefined) continue;
      if (patch[inputKey] === null) delete next[storedKey];
      else {
        if (!this.assets) throw new AuthServiceError(503, 'UPLOAD_UNAVAILABLE', 'Chưa cấu hình kho file.');
        try { next[storedKey] = await resolveOwnedAsset(this.assets, patch[inputKey], userId, kind); }
        catch (error) { throw new AuthServiceError(error.status || 400, error.code || 'INVALID_FILE', error.message); }
      }
      next.provenance.field_origins[storedKey] = 'candidate_self_service';
    }
    const validation = candidateDocumentSchema.safeParse(next);
    if (!validation.success) throw new AuthServiceError(400, 'VALIDATION_ERROR', 'The updated profile does not satisfy the approved Candidate schema.');

    let result;
    try {
      result = await this.candidates.update(validation.data, expectedRevision);
    } catch (error) {
      if (error?.code === 'CONFLICT') throw new AuthServiceError(409, 'REVISION_CONFLICT', 'The profile changed. Reload it and try again.');
      throw error;
    }
    return { profile: safeProfileDto({ ...validation.data, _rev: result?.rev ?? validation.data._rev }), revision: result?.rev ?? validation.data._rev };
  }
}
