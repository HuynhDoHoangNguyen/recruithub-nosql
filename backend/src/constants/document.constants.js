/**
 * DATA-02A Approved Document Constants & Enumerations
 * 
 * Defines standard document types, ID namespaces, availability states,
 * requirement configurations, degree ranks, and normalization alias tables.
 */

export const DOCUMENT_TYPES = Object.freeze({
  USER: 'user',
  CANDIDATE: 'candidate',
  RECRUITER: 'recruiter',
  COMPANY: 'company',
  DEPARTMENT: 'department',
  JOB: 'job',
  APPLICATION: 'application',
  INTERVIEW: 'interview',
  RESUME_ANALYSIS: 'resume_analysis',
});

export const ID_PREFIXES = Object.freeze({
  USER: 'user:',
  CANDIDATE: 'candidate:cms:',
  JOB: 'job:cms:',
  APPLICATION: 'application:pair:',
  INTERVIEW: 'interview:',
  RESUME_ANALYSIS: 'analysis:',
  RECRUITER: 'recruiter:',
  COMPANY: 'company:',
  DEPARTMENT: 'department:',
});

export const AVAILABILITY_STATES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  PARTIAL: 'PARTIAL',
  NONE_DECLARED: 'NONE_DECLARED',
  SYNTHETIC: 'SYNTHETIC',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const PROVENANCE_CLASSIFICATIONS = Object.freeze({
  SOURCE: 'source',
  NORMALIZED: 'normalized',
  DERIVED: 'derived',
  SYNTHETIC: 'synthetic',
  MIXED: 'mixed',
  // Legacy-only document classification; new writes must use a standard class.
  UNAVAILABLE: 'unavailable',
});

export const SENIORITY_LEVELS = Object.freeze({
  JUNIOR: 'JUNIOR',
  MID: 'MID',
  SENIOR: 'SENIOR',
});

export const JOB_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
});

export const REQUIREMENT_STATUSES = Object.freeze({
  EXPERIENCE: Object.freeze({
    REQUIRED: 'REQUIRED',
    NO_MINIMUM: 'NO_MINIMUM',
    UNAVAILABLE: 'UNAVAILABLE',
  }),
  EDUCATION: Object.freeze({
    REQUIRED: 'REQUIRED',
    NO_MINIMUM: 'NO_MINIMUM',
    UNAVAILABLE: 'UNAVAILABLE',
  }),
  PROJECT: Object.freeze({
    REQUIRED: 'REQUIRED',
    NO_REQUIREMENT: 'NO_REQUIREMENT',
    UNAVAILABLE: 'UNAVAILABLE',
  }),
});

export const CANONICAL_DEGREES = Object.freeze({
  HIGH_SCHOOL: 'HIGH_SCHOOL',
  BACHELOR: 'BACHELOR',
  MASTER: 'MASTER',
  DOCTORATE: 'DOCTORATE',
});

export const DEGREE_RANKS = Object.freeze({
  HIGH_SCHOOL: 1,
  BACHELOR: 2,
  MASTER: 3,
  DOCTORATE: 4,
});

// Fingerprint configuration identifiers. Any behavior or mapping change must
// use a new identifier so stored analyses are invalidated deterministically.
export const SKILL_NORMALIZATION_VERSION = 'skill-normalization-v1';
export const DEGREE_MAPPING_VERSION = 'degree-mapping-v1';

/**
 * Approved Degree mapping table (DATA-02A Section 7 / Section 13).
 * Normalizes source education terms to canonical degree tiers.
 */
export const DEGREE_MAPPING_TABLE = Object.freeze({
  'high school': CANONICAL_DEGREES.HIGH_SCHOOL,
  'high_school': CANONICAL_DEGREES.HIGH_SCHOOL,
  'secondary': CANONICAL_DEGREES.HIGH_SCHOOL,
  'highschool': CANONICAL_DEGREES.HIGH_SCHOOL,
  'ba': CANONICAL_DEGREES.BACHELOR,
  'bsc': CANONICAL_DEGREES.BACHELOR,
  'bachelor': CANONICAL_DEGREES.BACHELOR,
  "bachelor's": CANONICAL_DEGREES.BACHELOR,
  'bachelors': CANONICAL_DEGREES.BACHELOR,
  'undergraduate': CANONICAL_DEGREES.BACHELOR,
  'ma': CANONICAL_DEGREES.MASTER,
  'msc': CANONICAL_DEGREES.MASTER,
  'mba': CANONICAL_DEGREES.MASTER,
  'master': CANONICAL_DEGREES.MASTER,
  "master's": CANONICAL_DEGREES.MASTER,
  'masters': CANONICAL_DEGREES.MASTER,
  'graduate': CANONICAL_DEGREES.MASTER,
  'phd': CANONICAL_DEGREES.DOCTORATE,
  'doctorate': CANONICAL_DEGREES.DOCTORATE,
  'doctoral': CANONICAL_DEGREES.DOCTORATE,
});

/**
 * Versioned Skill Alias Map (v1)
 * Preserves skill meaning while harmonizing alternative spelling/formatting.
 */
export const SKILL_ALIAS_MAP_V1 = Object.freeze({
  'react.js': 'react',
  'reactjs': 'react',
  'node': 'node.js',
  'nodejs': 'node.js',
  'golang': 'go',
  'postgres': 'postgresql',
  'mongo': 'mongodb',
  'k8s': 'kubernetes',
  'rest api': 'rest apis',
  'restful api': 'rest apis',
  'restful apis': 'rest apis',
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
});

export const APPLICATION_STAGES = Object.freeze({
  APPLIED: 'APPLIED',
  SCREENING: 'SCREENING',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
});

export const USER_ROLES = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  RECRUITER: 'RECRUITER',
  ADMIN: 'ADMIN',
});

export const USER_ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  RESET_REQUIRED: 'RESET_REQUIRED',
});
