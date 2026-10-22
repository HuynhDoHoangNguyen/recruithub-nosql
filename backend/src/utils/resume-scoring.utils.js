/**
 * DATA-03.4A Pure Resume Scoring Engine & Freshness Utilities
 * 
 * Implements approved MVP scoring model (recruithub-scoring-mvp-v1):
 * - Skill Score (SKILL-COV, 50%): Required skill coverage
 * - Experience Score (EXP-A, 25%): Continuous capped ratio
 * - Education Score (EDU-B, 10%): Binary minimum qualification
 * - Project Score (PROJ-A, 15%): Required technology coverage
 * - COMPLETE vs INCOMPLETE handling
 * - Deterministic input fingerprint and freshness validation
 * - Deterministic per-Job ranking with tie-breakers
 */

import { createHash } from 'node:crypto';
import {
  APPLICATION_STAGES,
  AVAILABILITY_STATES,
  DEGREE_RANKS,
  DOCUMENT_TYPES,
  REQUIREMENT_STATUSES,
} from '../constants/document.constants.js';
import {
  normalizeSkill,
  normalizeDegree,
  canonicalizeValue,
} from './normalization.utils.js';
import {
  SCORING_ALGORITHM_VERSION,
  ANALYSIS_STATUSES,
  SCORING_WEIGHTS,
  RECOMMENDATION_THRESHOLDS,
  RECOMMENDATION_LEVELS,
} from '../schemas/resume-analysis.schema.js';

/**
 * Calculates Skill Score (50%, SKILL-COV).
 * 
 * @param {string[]} jobRequiredSkills 
 * @param {Array<string|{name: string, normalized?: string}>} candidateSkills 
 * @param {string} [candidateAvailability=AVAILABILITY_STATES.AVAILABLE]
 * @returns {{ score: number|null, matched: string[], missing: string[], details: Object, missingInput?: Object }}
 */
export function calculateSkillScore(jobRequiredSkills, candidateSkills, candidateAvailability = AVAILABILITY_STATES.AVAILABLE) {
  if (candidateAvailability === AVAILABILITY_STATES.UNAVAILABLE) {
    return {
      score: null,
      matched: [],
      missing: [],
      details: {
        formula_id: 'SKILL-COV',
        matched_count: 0,
        required_count: Array.isArray(jobRequiredSkills) ? jobRequiredSkills.length : 0,
        matched_skills: [],
        missing_skills: [],
        unrounded_score: null,
      },
      missingInput: {
        component: 'skill',
        code: 'CANDIDATE_SKILLS_UNAVAILABLE',
        message: 'Candidate skills availability is UNAVAILABLE',
      },
    };
  }

  if (!Array.isArray(jobRequiredSkills) || jobRequiredSkills.length === 0) {
    return {
      score: null,
      matched: [],
      missing: [],
      details: {
        formula_id: 'SKILL-COV',
        matched_count: 0,
        required_count: 0,
        matched_skills: [],
        missing_skills: [],
        unrounded_score: null,
      },
      missingInput: {
        component: 'skill',
        code: 'EMPTY_JOB_REQUIRED_SKILLS',
        message: 'Job required_skills must be a non-empty array',
      },
    };
  }

  // Deduplicate and normalize required skills
  const normalizedRequiredSet = new Set();
  for (const skill of jobRequiredSkills) {
    if (typeof skill === 'string' && skill.trim()) {
      normalizedRequiredSet.add(normalizeSkill(skill));
    }
  }

  const requiredList = Array.from(normalizedRequiredSet).sort();
  if (requiredList.length === 0) {
    return {
      score: null,
      matched: [],
      missing: [],
      details: {
        formula_id: 'SKILL-COV',
        matched_count: 0,
        required_count: 0,
        matched_skills: [],
        missing_skills: [],
        unrounded_score: null,
      },
      missingInput: {
        component: 'skill',
        code: 'EMPTY_JOB_REQUIRED_SKILLS',
        message: 'Job required_skills contains no valid non-empty skills',
      },
    };
  }

  // Deduplicate and normalize candidate skills
  const normalizedCandidateSet = new Set();
  if (Array.isArray(candidateSkills) && candidateAvailability !== AVAILABILITY_STATES.NONE_DECLARED) {
    for (const item of candidateSkills) {
      if (typeof item === 'string' && item.trim()) {
        normalizedCandidateSet.add(normalizeSkill(item));
      } else if (item && typeof item === 'object') {
        const raw = item.normalized || item.name;
        if (typeof raw === 'string' && raw.trim()) {
          normalizedCandidateSet.add(normalizeSkill(raw));
        }
      }
    }
  }

  const matched = [];
  const missing = [];

  for (const reqSkill of requiredList) {
    if (normalizedCandidateSet.has(reqSkill)) {
      matched.push(reqSkill);
    } else {
      missing.push(reqSkill);
    }
  }

  const score = (100 * matched.length) / requiredList.length;

  return {
    score,
    matched,
    missing,
    details: {
      formula_id: 'SKILL-COV',
      matched_count: matched.length,
      required_count: requiredList.length,
      matched_skills: matched,
      missing_skills: missing,
      unrounded_score: score,
    },
  };
}

/**
 * Calculates Experience Score (25%, EXP-A).
 * 
 * @param {Object} jobExperienceReq 
 * @param {number|null|undefined} candidateMonths 
 * @param {string} [candidateAvailability=AVAILABILITY_STATES.AVAILABLE]
 * @returns {{ score: number|null, details: Object, missingInput?: Object }}
 */
export function calculateExperienceScore(jobExperienceReq, candidateMonths, candidateAvailability = AVAILABILITY_STATES.AVAILABLE) {
  const reqStatus = jobExperienceReq?.status;

  if (reqStatus === REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM) {
    return {
      score: 100,
      details: {
        formula_id: 'EXP-A',
        candidate_months: typeof candidateMonths === 'number' ? candidateMonths : null,
        required_months: null,
        requirement_status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM,
        unrounded_score: 100,
      },
    };
  }

  if (!reqStatus || reqStatus === REQUIREMENT_STATUSES.EXPERIENCE.UNAVAILABLE) {
    return {
      score: null,
      details: {
        formula_id: 'EXP-A',
        candidate_months: typeof candidateMonths === 'number' ? candidateMonths : null,
        required_months: null,
        requirement_status: reqStatus || 'UNAVAILABLE',
        unrounded_score: null,
      },
      missingInput: {
        component: 'experience',
        code: 'MISSING_JOB_EXPERIENCE_REQUIREMENT',
        message: 'Job experience requirement is missing or UNAVAILABLE',
      },
    };
  }

  if (reqStatus === REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED) {
    const requiredMonths = jobExperienceReq.required_months;
    if (typeof requiredMonths !== 'number' || requiredMonths <= 0) {
      return {
        score: null,
        details: {
          formula_id: 'EXP-A',
          candidate_months: typeof candidateMonths === 'number' ? candidateMonths : null,
          required_months: null,
          requirement_status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED,
          unrounded_score: null,
        },
        missingInput: {
          component: 'experience',
          code: 'INVALID_JOB_EXPERIENCE_REQUIREMENT',
          message: 'Job required_months is missing or non-positive',
        },
      };
    }

    if (
      candidateAvailability === AVAILABILITY_STATES.UNAVAILABLE ||
      typeof candidateMonths !== 'number' ||
      candidateMonths < 0
    ) {
      return {
        score: null,
        details: {
          formula_id: 'EXP-A',
          candidate_months: null,
          required_months: requiredMonths,
          requirement_status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED,
          unrounded_score: null,
        },
        missingInput: {
          component: 'experience',
          code: 'MISSING_CANDIDATE_EXPERIENCE',
          message: 'Candidate experience_months is missing or UNAVAILABLE',
        },
      };
    }

    const score = Math.min(100, (100 * candidateMonths) / requiredMonths);
    return {
      score,
      details: {
        formula_id: 'EXP-A',
        candidate_months: candidateMonths,
        required_months: requiredMonths,
        requirement_status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED,
        unrounded_score: score,
      },
    };
  }

  return {
    score: null,
    details: {
      formula_id: 'EXP-A',
      candidate_months: null,
      required_months: null,
      requirement_status: reqStatus,
      unrounded_score: null,
    },
    missingInput: {
      component: 'experience',
      code: 'UNRECOGNIZED_EXPERIENCE_REQUIREMENT',
      message: `Unrecognized job experience status: ${reqStatus}`,
    },
  };
}

/**
 * Calculates Education Score (10%, EDU-B).
 * 
 * @param {Object} jobEducationReq 
 * @param {Array<Object|string>} candidateEducation 
 * @param {string} [candidateAvailability=AVAILABILITY_STATES.AVAILABLE]
 * @returns {{ score: number|null, details: Object, missingInput?: Object }}
 */
export function calculateEducationScore(jobEducationReq, candidateEducation, candidateAvailability = AVAILABILITY_STATES.AVAILABLE) {
  const reqStatus = jobEducationReq?.status;

  // Determine candidate's highest normalized degree rank
  let highestDegree = null;
  let highestRank = 0;

  if (Array.isArray(candidateEducation) && candidateAvailability !== AVAILABILITY_STATES.NONE_DECLARED) {
    for (const item of candidateEducation) {
      const rawDegree = typeof item === 'string' ? item : item?.degree;
      if (rawDegree) {
        try {
          const canonical = normalizeDegree(rawDegree);
          const rank = DEGREE_RANKS[canonical] || 0;
          if (rank > highestRank) {
            highestRank = rank;
            highestDegree = canonical;
          }
        } catch (_) {}
      }
    }
  }

  if (reqStatus === REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM) {
    return {
      score: 100,
      details: {
        formula_id: 'EDU-B',
        candidate_degree: highestDegree,
        candidate_rank: highestRank,
        minimum_degree: null,
        minimum_rank: null,
        requirement_status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM,
        unrounded_score: 100,
      },
    };
  }

  if (!reqStatus || reqStatus === REQUIREMENT_STATUSES.EDUCATION.UNAVAILABLE) {
    return {
      score: null,
      details: {
        formula_id: 'EDU-B',
        candidate_degree: highestDegree,
        candidate_rank: highestRank,
        minimum_degree: null,
        minimum_rank: null,
        requirement_status: reqStatus || 'UNAVAILABLE',
        unrounded_score: null,
      },
      missingInput: {
        component: 'education',
        code: 'MISSING_JOB_EDUCATION_REQUIREMENT',
        message: 'Job education requirement is missing or UNAVAILABLE',
      },
    };
  }

  if (reqStatus === REQUIREMENT_STATUSES.EDUCATION.REQUIRED) {
    const rawMin = jobEducationReq.minimum_degree;
    let minDegree = null;
    let minRank = 0;

    if (rawMin) {
      try {
        minDegree = normalizeDegree(rawMin);
        minRank = DEGREE_RANKS[minDegree] || 0;
      } catch (_) {}
    }

    if (!minDegree || minRank <= 0) {
      return {
        score: null,
        details: {
          formula_id: 'EDU-B',
          candidate_degree: highestDegree,
          candidate_rank: highestRank,
          minimum_degree: null,
          minimum_rank: null,
          requirement_status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED,
          unrounded_score: null,
        },
        missingInput: {
          component: 'education',
          code: 'INVALID_JOB_EDUCATION_REQUIREMENT',
          message: 'Job minimum_degree is missing or invalid',
        },
      };
    }

    if (candidateAvailability === AVAILABILITY_STATES.UNAVAILABLE) {
      return {
        score: null,
        details: {
          formula_id: 'EDU-B',
          candidate_degree: null,
          candidate_rank: null,
          minimum_degree: minDegree,
          minimum_rank: minRank,
          requirement_status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED,
          unrounded_score: null,
        },
        missingInput: {
          component: 'education',
          code: 'CANDIDATE_EDUCATION_UNAVAILABLE',
          message: 'Candidate education evidence is UNAVAILABLE',
        },
      };
    }

    const score = highestRank >= minRank ? 100 : 0;
    return {
      score,
      details: {
        formula_id: 'EDU-B',
        candidate_degree: highestDegree,
        candidate_rank: highestRank,
        minimum_degree: minDegree,
        minimum_rank: minRank,
        requirement_status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED,
        unrounded_score: score,
      },
    };
  }

  return {
    score: null,
    details: {
      formula_id: 'EDU-B',
      candidate_degree: highestDegree,
      candidate_rank: highestRank,
      minimum_degree: null,
      minimum_rank: null,
      requirement_status: reqStatus,
      unrounded_score: null,
    },
    missingInput: {
      component: 'education',
      code: 'UNRECOGNIZED_EDUCATION_REQUIREMENT',
      message: `Unrecognized job education status: ${reqStatus}`,
    },
  };
}

/**
 * Calculates Project Score (15%, PROJ-A).
 * 
 * @param {Object} jobProjectReq 
 * @param {Array<Object>} candidateProjects 
 * @param {string} [candidateAvailability=AVAILABILITY_STATES.AVAILABLE]
 * @returns {{ score: number|null, details: Object, missingInput?: Object }}
 */
export function calculateProjectScore(jobProjectReq, candidateProjects, candidateAvailability = AVAILABILITY_STATES.AVAILABLE) {
  const reqStatus = jobProjectReq?.status;

  // Collect candidate normalized technologies across all projects
  const candTechSet = new Set();
  if (Array.isArray(candidateProjects) && candidateAvailability !== AVAILABILITY_STATES.NONE_DECLARED) {
    for (const proj of candidateProjects) {
      if (Array.isArray(proj.technologies)) {
        for (const t of proj.technologies) {
          if (typeof t === 'string' && t.trim()) {
            candTechSet.add(normalizeSkill(t));
          }
        }
      }
    }
  }
  const candTechList = Array.from(candTechSet).sort();

  if (reqStatus === REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT) {
    return {
      score: 100,
      details: {
        formula_id: 'PROJ-A',
        candidate_technologies: candTechList,
        required_technologies: [],
        matched_technologies: [],
        missing_technologies: [],
        requirement_status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT,
        unrounded_score: 100,
      },
    };
  }

  if (!reqStatus || reqStatus === REQUIREMENT_STATUSES.PROJECT.UNAVAILABLE) {
    return {
      score: null,
      details: {
        formula_id: 'PROJ-A',
        candidate_technologies: candTechList,
        required_technologies: [],
        matched_technologies: [],
        missing_technologies: [],
        requirement_status: reqStatus || 'UNAVAILABLE',
        unrounded_score: null,
      },
      missingInput: {
        component: 'project',
        code: 'MISSING_JOB_PROJECT_REQUIREMENT',
        message: 'Job project requirement is missing or UNAVAILABLE',
      },
    };
  }

  if (reqStatus === REQUIREMENT_STATUSES.PROJECT.REQUIRED) {
    const rawReqTechs = jobProjectReq.required_technologies;
    const reqTechSet = new Set();
    if (Array.isArray(rawReqTechs)) {
      for (const t of rawReqTechs) {
        if (typeof t === 'string' && t.trim()) {
          reqTechSet.add(normalizeSkill(t));
        }
      }
    }
    const reqTechList = Array.from(reqTechSet).sort();

    if (reqTechList.length === 0) {
      return {
        score: null,
        details: {
          formula_id: 'PROJ-A',
          candidate_technologies: candTechList,
          required_technologies: [],
          matched_technologies: [],
          missing_technologies: [],
          requirement_status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
          unrounded_score: null,
        },
        missingInput: {
          component: 'project',
          code: 'EMPTY_JOB_REQUIRED_TECHNOLOGIES',
          message: 'Job required_technologies is empty',
        },
      };
    }

    if (candidateAvailability === AVAILABILITY_STATES.UNAVAILABLE) {
      return {
        score: null,
        details: {
          formula_id: 'PROJ-A',
          candidate_technologies: [],
          required_technologies: reqTechList,
          matched_technologies: [],
          missing_technologies: reqTechList,
          requirement_status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
          unrounded_score: null,
        },
        missingInput: {
          component: 'project',
          code: 'CANDIDATE_PROJECTS_UNAVAILABLE',
          message: 'Candidate project evidence is UNAVAILABLE',
        },
      };
    }

    if (candidateAvailability === AVAILABILITY_STATES.NONE_DECLARED) {
      return {
        score: 0,
        details: {
          formula_id: 'PROJ-A',
          candidate_technologies: [],
          required_technologies: reqTechList,
          matched_technologies: [],
          missing_technologies: reqTechList,
          requirement_status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
          unrounded_score: 0,
        },
      };
    }

    const matched = [];
    const missing = [];
    for (const tech of reqTechList) {
      if (candTechSet.has(tech)) {
        matched.push(tech);
      } else {
        missing.push(tech);
      }
    }

    const score = (100 * matched.length) / reqTechList.length;
    return {
      score,
      details: {
        formula_id: 'PROJ-A',
        candidate_technologies: candTechList,
        required_technologies: reqTechList,
        matched_technologies: matched,
        missing_technologies: missing,
        requirement_status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
        unrounded_score: score,
      },
    };
  }

  return {
    score: null,
    details: {
      formula_id: 'PROJ-A',
      candidate_technologies: candTechList,
      required_technologies: [],
      matched_technologies: [],
      missing_technologies: [],
      requirement_status: reqStatus,
      unrounded_score: null,
    },
    missingInput: {
      component: 'project',
      code: 'UNRECOGNIZED_PROJECT_REQUIREMENT',
      message: `Unrecognized job project status: ${reqStatus}`,
    },
  };
}

/**
 * Computes deterministic 64-hex SHA-256 input fingerprint.
 * 
 * Includes only score-relevant candidate and job attributes, algorithm version,
 * weights, and threshold configuration.
 * 
 * @param {Object} params
 * @param {Object} params.candidate
 * @param {Object} params.job
 * @param {string} [params.algorithmVersion=SCORING_ALGORITHM_VERSION]
 * @returns {string} 64-hex SHA-256 fingerprint
 */
export function computeInputFingerprint({ candidate, job, algorithmVersion = SCORING_ALGORITHM_VERSION }) {
  if (!candidate || !job) {
    throw new Error('computeInputFingerprint requires candidate and job objects');
  }

  // 1. Normalized candidate skills (sorted array of strings)
  const candSkillsSet = new Set();
  if (Array.isArray(candidate.skills)) {
    for (const item of candidate.skills) {
      const raw = typeof item === 'string' ? item : item?.normalized || item?.name;
      if (raw) {
        try {
          candSkillsSet.add(normalizeSkill(raw));
        } catch (_) {}
      }
    }
  }

  // 2. Candidate experience
  const expMonths = typeof candidate.profile?.experience_months === 'number'
    ? candidate.profile.experience_months
    : null;

  // 3. Normalized candidate education degrees (sorted array)
  const candDegreesSet = new Set();
  if (Array.isArray(candidate.education)) {
    for (const item of candidate.education) {
      const raw = typeof item === 'string' ? item : item?.degree;
      if (raw) {
        try {
          candDegreesSet.add(normalizeDegree(raw));
        } catch (_) {}
      }
    }
  }

  // 4. Candidate project technologies (sorted array)
  const candTechSet = new Set();
  if (Array.isArray(candidate.projects)) {
    for (const proj of candidate.projects) {
      if (Array.isArray(proj.technologies)) {
        for (const t of proj.technologies) {
          if (typeof t === 'string' && t.trim()) {
            try {
              candTechSet.add(normalizeSkill(t));
            } catch (_) {}
          }
        }
      }
    }
  }

  // 5. Job required skills (sorted array)
  const jobReqSkillsSet = new Set();
  if (Array.isArray(job.required_skills)) {
    for (const s of job.required_skills) {
      if (typeof s === 'string' && s.trim()) {
        try {
          jobReqSkillsSet.add(normalizeSkill(s));
        } catch (_) {}
      }
    }
  }

  // 6. Job requirements
  const jobExpReq = job.requirements?.experience
    ? {
        status: job.requirements.experience.status,
        required_months: job.requirements.experience.required_months || null,
      }
    : null;

  const jobEduReq = job.requirements?.education
    ? {
        status: job.requirements.education.status,
        minimum_degree: job.requirements.education.minimum_degree
          ? normalizeDegree(job.requirements.education.minimum_degree)
          : null,
      }
    : null;

  const jobProjReq = job.requirements?.project
    ? {
        status: job.requirements.project.status,
        required_technologies: Array.isArray(job.requirements.project.required_technologies)
          ? Array.from(new Set(job.requirements.project.required_technologies.map((t) => normalizeSkill(t)))).sort()
          : [],
      }
    : null;

  const payload = {
    algorithm_version: algorithmVersion,
    weights: SCORING_WEIGHTS,
    thresholds: RECOMMENDATION_THRESHOLDS,
    candidate: {
      id: candidate._id,
      skills: Array.from(candSkillsSet).sort(),
      experience_months: expMonths,
      education_degrees: Array.from(candDegreesSet).sort(),
      project_technologies: Array.from(candTechSet).sort(),
      availability: {
        skills: candidate.data_availability?.skills || AVAILABILITY_STATES.AVAILABLE,
        experience: candidate.data_availability?.experience || AVAILABILITY_STATES.AVAILABLE,
        education: candidate.data_availability?.education || AVAILABILITY_STATES.AVAILABLE,
        projects: candidate.data_availability?.projects || AVAILABILITY_STATES.AVAILABLE,
      },
    },
    job: {
      id: job._id,
      required_skills: Array.from(jobReqSkillsSet).sort(),
      requirements: {
        experience: jobExpReq,
        education: jobEduReq,
        project: jobProjReq,
      },
    },
  };

  const canonicalPayload = canonicalizeValue(payload);
  const jsonString = JSON.stringify(canonicalPayload);
  return createHash('sha256').update(jsonString, 'utf8').digest('hex');
}

/**
 * Checks whether an existing Resume Analysis is fresh against current Candidate & Job inputs.
 * 
 * @param {Object} analysis 
 * @param {Object} candidate 
 * @param {Object} job 
 * @returns {boolean}
 */
export function isAnalysisFresh(analysis, candidate, job) {
  if (!analysis || !candidate || !job) return false;
  if (analysis.algorithm_version !== SCORING_ALGORITHM_VERSION) return false;
  if (analysis.candidate_id !== candidate._id) return false;
  if (analysis.job_id !== job._id) return false;

  const currentFingerprint = computeInputFingerprint({ candidate, job });
  return analysis.input_fingerprint === currentFingerprint;
}

/**
 * Evaluates Resume Analysis for an Application.
 * 
 * @param {Object} params
 * @param {Object} params.application
 * @param {Object} params.candidate
 * @param {Object} params.job
 * @param {string} params.analyzedAt
 * @param {Object} [params.provenance]
 * @returns {Object} Complete or Incomplete Resume Analysis document
 */
export function evaluateResumeAnalysis({ application, candidate, job, analyzedAt, provenance }) {
  if (!application || !candidate || !job) {
    throw new Error('evaluateResumeAnalysis requires application, candidate, and job documents');
  }

  // 1. Skill Score
  const candSkillAvail = candidate.data_availability?.skills || AVAILABILITY_STATES.AVAILABLE;
  const skillRes = calculateSkillScore(job.required_skills, candidate.skills, candSkillAvail);

  // 2. Experience Score
  const candExpAvail = candidate.data_availability?.experience || AVAILABILITY_STATES.AVAILABLE;
  const expRes = calculateExperienceScore(job.requirements?.experience, candidate.profile?.experience_months, candExpAvail);

  // 3. Education Score
  const candEduAvail = candidate.data_availability?.education || AVAILABILITY_STATES.AVAILABLE;
  const eduRes = calculateEducationScore(job.requirements?.education, candidate.education, candEduAvail);

  // 4. Project Score
  const candProjAvail = candidate.data_availability?.projects || AVAILABILITY_STATES.AVAILABLE;
  const projRes = calculateProjectScore(job.requirements?.project, candidate.projects, candProjAvail);

  const missingInputs = [];
  if (skillRes.missingInput) missingInputs.push(skillRes.missingInput);
  if (expRes.missingInput) missingInputs.push(expRes.missingInput);
  if (eduRes.missingInput) missingInputs.push(eduRes.missingInput);
  if (projRes.missingInput) missingInputs.push(projRes.missingInput);

  const isComplete = missingInputs.length === 0 &&
    skillRes.score !== null &&
    expRes.score !== null &&
    eduRes.score !== null &&
    projRes.score !== null;

  let totalScore;
  let recommendation;

  if (isComplete) {
    totalScore =
      SCORING_WEIGHTS.SKILL * skillRes.score +
      SCORING_WEIGHTS.EXPERIENCE * expRes.score +
      SCORING_WEIGHTS.EDUCATION * eduRes.score +
      SCORING_WEIGHTS.PROJECT * projRes.score;

    if (totalScore >= RECOMMENDATION_THRESHOLDS.HIGH) {
      recommendation = RECOMMENDATION_LEVELS.HIGH;
    } else if (totalScore >= RECOMMENDATION_THRESHOLDS.MEDIUM) {
      recommendation = RECOMMENDATION_LEVELS.MEDIUM;
    } else {
      recommendation = RECOMMENDATION_LEVELS.LOW;
    }
  }

  const fingerprint = computeInputFingerprint({ candidate, job });
  const analysisId = `analysis:${application._id}`;

  const defaultProvenance = {
    classification: 'derived',
    generator_version: SCORING_ALGORITHM_VERSION,
  };

  const analysisDoc = {
    _id: analysisId,
    type: DOCUMENT_TYPES.RESUME_ANALYSIS,
    application_id: application._id,
    candidate_id: candidate._id,
    job_id: job._id,
    analysis_status: isComplete ? ANALYSIS_STATUSES.COMPLETE : ANALYSIS_STATUSES.INCOMPLETE,
    scores: {
      skill: skillRes.score,
      experience: expRes.score,
      education: eduRes.score,
      project: projRes.score,
    },
    matched_skills: skillRes.matched,
    missing_skills: skillRes.missing,
    component_details: {
      skill: skillRes.details,
      experience: expRes.details,
      education: eduRes.details,
      project: projRes.details,
    },
    missing_inputs: missingInputs,
    algorithm_version: SCORING_ALGORITHM_VERSION,
    input_fingerprint: fingerprint,
    analyzed_at: analyzedAt,
    provenance: provenance || defaultProvenance,
  };

  if (isComplete) {
    analysisDoc.total_score = totalScore;
    analysisDoc.recommendation = recommendation;
  }

  return analysisDoc;
}

/**
 * Deterministically ranks candidates for a Job.
 * 
 * Rules:
 * - Scoped strictly to one Job.
 * - Only fresh and COMPLETE analyses are ranked.
 * - Excludes WITHDRAWN applications in all modes.
 * - Active mode: APPLIED, SCREENING, INTERVIEW, OFFER.
 * - Historical mode: APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED.
 * - Stable tie-breakers:
 *   1. total_score DESC (unrounded)
 *   2. scores.skill DESC (unrounded)
 *   3. application.applied_at ASC
 *   4. application._id ASC
 * 
 * @param {Array<Object>} analyses 
 * @param {Map<string, Object>} applicationsMap - Map(appId -> application doc)
 * @param {Object} [options]
 * @param {string} [options.jobId] - Optional job scope filter
 * @param {'ACTIVE'|'HISTORICAL'} [options.mode='ACTIVE']
 * @returns {Array<{ rank: number, analysis: Object, application: Object }>}
 */
export function rankAnalyses(analyses, applicationsMap, options = {}) {
  const mode = options.mode || 'ACTIVE';
  const jobId = options.jobId;

  const eligibleStages = mode === 'HISTORICAL'
    ? [
        APPLICATION_STAGES.APPLIED,
        APPLICATION_STAGES.SCREENING,
        APPLICATION_STAGES.INTERVIEW,
        APPLICATION_STAGES.OFFER,
        APPLICATION_STAGES.HIRED,
        APPLICATION_STAGES.REJECTED,
      ]
    : [
        APPLICATION_STAGES.APPLIED,
        APPLICATION_STAGES.SCREENING,
        APPLICATION_STAGES.INTERVIEW,
        APPLICATION_STAGES.OFFER,
      ];

  const eligibleItems = [];

  for (const analysis of analyses) {
    if (analysis.analysis_status !== ANALYSIS_STATUSES.COMPLETE) {
      continue; // Exclude INCOMPLETE
    }
    if (jobId && analysis.job_id !== jobId) {
      continue; // Scope to one job
    }

    const app = applicationsMap.get(analysis.application_id);
    if (!app) continue;

    // Check application stage eligibility
    if (!eligibleStages.includes(app.current_stage)) {
      continue;
    }

    eligibleItems.push({ analysis, application: app });
  }

  eligibleItems.sort((a, b) => {
    // 1. total_score DESC (unrounded)
    const diffTotal = b.analysis.total_score - a.analysis.total_score;
    if (Math.abs(diffTotal) > 1e-9) {
      return diffTotal;
    }

    // 2. scores.skill DESC (unrounded)
    const diffSkill = b.analysis.scores.skill - a.analysis.scores.skill;
    if (Math.abs(diffSkill) > 1e-9) {
      return diffSkill;
    }

    // 3. application.applied_at ASC
    const timeA = new Date(a.application.applied_at).getTime();
    const timeB = new Date(b.application.applied_at).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 4. application._id ASC
    return a.application._id.localeCompare(b.application._id);
  });

  return eligibleItems.map((item, idx) => ({
    rank: idx + 1,
    analysis: item.analysis,
    application: item.application,
  }));
}
