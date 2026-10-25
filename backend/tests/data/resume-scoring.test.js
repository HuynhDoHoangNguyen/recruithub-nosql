/**
 * Unit tests for DATA-03.4A: Resume Scoring Engine, Fingerprinting, Freshness & Ranking
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLICATION_STAGES,
  AVAILABILITY_STATES,
  DEGREE_MAPPING_VERSION,
  DOCUMENT_TYPES,
  JOB_STATUSES,
  PROVENANCE_CLASSIFICATIONS,
  REQUIREMENT_STATUSES,
  SKILL_NORMALIZATION_VERSION,
} from '../../src/constants/document.constants.js';
import {
  calculateSkillScore,
  calculateExperienceScore,
  calculateEducationScore,
  calculateProjectScore,
  computeInputFingerprint,
  isAnalysisFresh,
  evaluateResumeAnalysis,
  rankAnalyses,
} from '../../src/utils/resume-scoring.utils.js';
import {
  SCORING_ALGORITHM_VERSION,
  ANALYSIS_STATUSES,
  RECOMMENDATION_LEVELS,
  resumeAnalysisDocumentSchema,
} from '../../src/schemas/resume-analysis.schema.js';

test('DATA-03.4A: Skill Scoring Acceptance Tests (50%, SKILL-COV)', async (t) => {
  await t.test('1. Full skill match gives 100', () => {
    const required = ['python', 'sql', 'docker'];
    const candidateSkills = ['python', 'sql', 'docker', 'git'];
    const res = calculateSkillScore(required, candidateSkills, AVAILABILITY_STATES.AVAILABLE);
    assert.equal(res.score, 100);
    assert.deepEqual(res.matched.sort(), ['docker', 'python', 'sql']);
    assert.deepEqual(res.missing, []);
  });

  await t.test('2. Partial skill match gives exact fractional coverage', () => {
    const required = ['python', 'sql', 'docker', 'git'];
    const candidateSkills = ['python', 'docker', 'git', 'excel'];
    const res = calculateSkillScore(required, candidateSkills, AVAILABILITY_STATES.AVAILABLE);
    assert.equal(res.score, 75); // 3 of 4 = 75
    assert.deepEqual(res.matched.sort(), ['docker', 'git', 'python']);
    assert.deepEqual(res.missing, ['sql']);
  });

  await t.test('3. Zero skill match gives 0', () => {
    const required = ['python', 'sql'];
    const candidateSkills = ['java', 'c++'];
    const res = calculateSkillScore(required, candidateSkills, AVAILABILITY_STATES.AVAILABLE);
    assert.equal(res.score, 0);
    assert.equal(res.matched.length, 0);
    assert.equal(res.missing.length, 2);
  });

  await t.test('4. Required skill normalization: aliases and whitespace collapsing', () => {
    // 'k8s' -> 'kubernetes', 'golang' -> 'go', 'node js' -> 'node.js'
    const required = ['k8s', 'golang'];
    const candidateSkills = ['Kubernetes', 'Go'];
    const res = calculateSkillScore(required, candidateSkills, AVAILABILITY_STATES.AVAILABLE);
    assert.equal(res.score, 100);
  });

  await t.test('5. Candidate skills UNAVAILABLE produces missing component', () => {
    const required = ['python'];
    const candidateSkills = ['python'];
    const res = calculateSkillScore(required, candidateSkills, AVAILABILITY_STATES.UNAVAILABLE);
    assert.equal(res.score, null);
    assert.equal(res.missingInput?.code, 'CANDIDATE_SKILLS_UNAVAILABLE');
  });

  await t.test('6. Candidate skills NONE_DECLARED produces 0', () => {
    const required = ['python'];
    const res = calculateSkillScore(required, [], AVAILABILITY_STATES.NONE_DECLARED);
    assert.equal(res.score, 0);
  });
});

test('DATA-03.4A: Experience Scoring Acceptance Tests (25%, EXP-A)', async (t) => {
  await t.test('7. Continuous ratio capped at 100', () => {
    const req = { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 48 };

    // 24 of 48 months -> 50
    assert.equal(calculateExperienceScore(req, 24, AVAILABILITY_STATES.AVAILABLE).score, 50);

    // 36 of 48 months -> 75
    assert.equal(calculateExperienceScore(req, 36, AVAILABILITY_STATES.AVAILABLE).score, 75);

    // 48 of 48 months -> 100
    assert.equal(calculateExperienceScore(req, 48, AVAILABILITY_STATES.AVAILABLE).score, 100);

    // 60 of 48 months -> capped at 100 (not 125)
    assert.equal(calculateExperienceScore(req, 60, AVAILABILITY_STATES.AVAILABLE).score, 100);
  });

  await t.test('8. NO_MINIMUM status gives 100', () => {
    const req = { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM };
    assert.equal(calculateExperienceScore(req, 0, AVAILABILITY_STATES.AVAILABLE).score, 100);
    assert.equal(calculateExperienceScore(req, null, AVAILABILITY_STATES.NONE_DECLARED).score, 100);
  });

  await t.test('9. UNAVAILABLE Job requirement produces missing component', () => {
    const req = { status: REQUIREMENT_STATUSES.EXPERIENCE.UNAVAILABLE };
    const res = calculateExperienceScore(req, 36, AVAILABILITY_STATES.AVAILABLE);
    assert.equal(res.score, null);
    assert.equal(res.missingInput?.code, 'MISSING_JOB_EXPERIENCE_REQUIREMENT');
  });

  await t.test('10. Missing or unavailable candidate experience produces missing component', () => {
    const req = { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 24 };
    const resMissing = calculateExperienceScore(req, null, AVAILABILITY_STATES.PARTIAL);
    assert.equal(resMissing.score, null);
    assert.equal(resMissing.missingInput?.code, 'MISSING_CANDIDATE_EXPERIENCE');

    const resUnavail = calculateExperienceScore(req, 24, AVAILABILITY_STATES.UNAVAILABLE);
    assert.equal(resUnavail.score, null);
    assert.equal(resUnavail.missingInput?.code, 'MISSING_CANDIDATE_EXPERIENCE');
  });
});

test('DATA-03.4A: Education Scoring Acceptance Tests (10%, EDU-B)', async (t) => {
  await t.test('11. Binary minimum qualification: rank comparison', () => {
    const reqBachelor = { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' };
    const reqMaster = { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'MASTER' };

    // Candidate BSc rank 2 vs Required MSc rank 3 -> 0
    assert.equal(calculateEducationScore(reqMaster, [{ degree: 'BACHELOR' }], AVAILABILITY_STATES.AVAILABLE).score, 0);

    // Candidate MSc rank 3 vs Required BSc rank 2 -> 100
    assert.equal(calculateEducationScore(reqBachelor, [{ degree: 'MASTER' }], AVAILABILITY_STATES.AVAILABLE).score, 100);

    // Candidate BSc rank 2 vs Required BSc rank 2 -> 100
    assert.equal(calculateEducationScore(reqBachelor, [{ degree: 'BACHELOR' }], AVAILABILITY_STATES.AVAILABLE).score, 100);
  });

  await t.test('12. NO_MINIMUM Education status gives 100', () => {
    const req = { status: REQUIREMENT_STATUSES.EDUCATION.NO_MINIMUM };
    assert.equal(calculateEducationScore(req, [], AVAILABILITY_STATES.NONE_DECLARED).score, 100);
  });

  await t.test('13. UNAVAILABLE Education requirement produces missing component', () => {
    const req = { status: REQUIREMENT_STATUSES.EDUCATION.UNAVAILABLE };
    const res = calculateEducationScore(req, [{ degree: 'MASTER' }], AVAILABILITY_STATES.AVAILABLE);
    assert.equal(res.score, null);
    assert.equal(res.missingInput?.code, 'MISSING_JOB_EDUCATION_REQUIREMENT');
  });
});

test('DATA-03.4A: Project Scoring Acceptance Tests (15%, PROJ-A)', async (t) => {
  await t.test('14. Required technology coverage: exact unrounded ratio', () => {
    const req = {
      status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
      required_technologies: ['node.js', 'couchdb', 'docker'],
    };
    const projects = [
      { technologies: ['node.js', 'docker', 'react'] },
    ];
    const res = calculateProjectScore(req, projects, AVAILABILITY_STATES.AVAILABLE);
    // 2 of 3 matched -> 200/3 = 66.66666666666667
    assert.equal(res.score, (100 * 2) / 3);
  });

  await t.test('15. NO_REQUIREMENT Project status gives 100', () => {
    const req = { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT };
    assert.equal(calculateProjectScore(req, [], AVAILABILITY_STATES.NONE_DECLARED).score, 100);
  });

  await t.test('16. Candidate projects NONE_DECLARED gives 0', () => {
    const req = {
      status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
      required_technologies: ['docker'],
    };
    const res = calculateProjectScore(req, [], AVAILABILITY_STATES.NONE_DECLARED);
    assert.equal(res.score, 0);
  });

  await t.test('17. UNAVAILABLE Project requirement or candidate evidence produces missing component', () => {
    const reqUnavail = { status: REQUIREMENT_STATUSES.PROJECT.UNAVAILABLE };
    assert.equal(calculateProjectScore(reqUnavail, [], AVAILABILITY_STATES.UNAVAILABLE).score, null);

    const reqReq = { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['docker'] };
    const resCandUnavail = calculateProjectScore(reqReq, [], AVAILABILITY_STATES.UNAVAILABLE);
    assert.equal(resCandUnavail.score, null);
    assert.equal(resCandUnavail.missingInput?.code, 'CANDIDATE_PROJECTS_UNAVAILABLE');
  });
});

test('TV3-UC19-003: Strict Candidate Availability Handling', async (t) => {
  const requiredSkills = ['python'];
  const experienceRequirement = {
    status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED,
    required_months: 12,
  };
  const educationRequirement = {
    status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED,
    minimum_degree: 'BACHELOR',
  };
  const projectRequirement = {
    status: REQUIREMENT_STATUSES.PROJECT.REQUIRED,
    required_technologies: ['docker'],
  };

  await t.test('missing availability never defaults to AVAILABLE', () => {
    assert.equal(
      calculateSkillScore(requiredSkills, ['python']).missingInput?.code,
      'MISSING_CANDIDATE_SKILLS_AVAILABILITY',
    );
    assert.equal(
      calculateExperienceScore(experienceRequirement, 12).missingInput?.code,
      'MISSING_CANDIDATE_EXPERIENCE_AVAILABILITY',
    );
    assert.equal(
      calculateEducationScore(educationRequirement, [{ degree: 'BACHELOR' }]).missingInput?.code,
      'MISSING_CANDIDATE_EDUCATION_AVAILABILITY',
    );
    assert.equal(
      calculateProjectScore(projectRequirement, [{ technologies: ['docker'] }]).missingInput?.code,
      'MISSING_CANDIDATE_PROJECTS_AVAILABILITY',
    );
  });

  await t.test('invalid availability cannot produce a component score', () => {
    const result = calculateSkillScore(requiredSkills, ['python'], 'UNKNOWN');
    assert.equal(result.score, null);
    assert.equal(result.missingInput?.code, 'INVALID_CANDIDATE_SKILLS_AVAILABILITY');
  });

  await t.test('PARTIAL and SYNTHETIC require actual evidence when the Job has a requirement', () => {
    const missingSkills = calculateSkillScore(requiredSkills, [], AVAILABILITY_STATES.PARTIAL);
    const missingEducation = calculateEducationScore(
      educationRequirement,
      [],
      AVAILABILITY_STATES.PARTIAL,
    );
    const missingProjects = calculateProjectScore(
      projectRequirement,
      [],
      AVAILABILITY_STATES.SYNTHETIC,
    );

    assert.equal(missingSkills.score, null);
    assert.equal(missingSkills.missingInput?.code, 'MISSING_CANDIDATE_SKILL_EVIDENCE');
    assert.equal(missingEducation.score, null);
    assert.equal(missingEducation.missingInput?.code, 'MISSING_CANDIDATE_EDUCATION_EVIDENCE');
    assert.equal(missingProjects.score, null);
    assert.equal(missingProjects.missingInput?.code, 'MISSING_CANDIDATE_PROJECT_EVIDENCE');
  });

  await t.test('explicit valid states preserve their distinct scoring semantics', () => {
    assert.equal(
      calculateSkillScore(requiredSkills, ['python'], AVAILABILITY_STATES.AVAILABLE).score,
      100,
    );
    assert.equal(
      calculateSkillScore(requiredSkills, [], AVAILABILITY_STATES.NONE_DECLARED).score,
      0,
    );
    assert.equal(
      calculateSkillScore(requiredSkills, ['python'], AVAILABILITY_STATES.UNAVAILABLE).score,
      null,
    );
    assert.equal(
      calculateSkillScore(requiredSkills, ['python'], AVAILABILITY_STATES.PARTIAL).score,
      100,
    );
    assert.equal(
      calculateProjectScore(
        projectRequirement,
        [{ technologies: ['docker'] }],
        AVAILABILITY_STATES.SYNTHETIC,
      ).score,
      100,
    );
  });

  await t.test('NO_MINIMUM and NO_REQUIREMENT still require explicit valid availability', () => {
    const noMinimum = { status: REQUIREMENT_STATUSES.EXPERIENCE.NO_MINIMUM };
    const noProjectRequirement = { status: REQUIREMENT_STATUSES.PROJECT.NO_REQUIREMENT };

    assert.equal(
      calculateExperienceScore(noMinimum, null, AVAILABILITY_STATES.NONE_DECLARED).score,
      100,
    );
    assert.equal(
      calculateProjectScore(noProjectRequirement, [], AVAILABILITY_STATES.NONE_DECLARED).score,
      100,
    );
    assert.equal(calculateExperienceScore(noMinimum, null).score, null);
    assert.equal(calculateProjectScore(noProjectRequirement, []).score, null);
  });
});

test('DATA-03.4A: Aggregate Total Score & Recommendation Acceptance Tests', async (t) => {
  const dummyApp = {
    _id: 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    applied_at: '2026-10-22T10:00:00Z',
    current_stage: APPLICATION_STAGES.APPLIED,
  };

  await t.test('18. Test Vector SC-V04 (HIGH unrounded): 100, 75, 100, 200/3 -> 88.75 HIGH', () => {
    const candidate = {
      _id: 'candidate:cms:R_000001',
      skills: ['python', 'sql', 'docker', 'git'],
      profile: { experience_months: 36 },
      education: [{ degree: 'MASTER' }],
      projects: [{ technologies: ['node.js', 'docker'] }],
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.AVAILABLE,
      },
    };

    const job = {
      _id: 'job:cms:J_000001',
      required_skills: ['python', 'sql', 'docker', 'git'], // 4/4 -> 100
      requirements: {
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 48 }, // 36/48 -> 75
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' }, // 100
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['node.js', 'docker', 'couchdb'] }, // 2/3 -> 200/3
      },
    };

    const analysis = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-22T12:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.COMPLETE);
    assert.equal(analysis.scores.skill, 100);
    assert.equal(analysis.scores.experience, 75);
    assert.equal(analysis.scores.education, 100);
    assert.equal(analysis.scores.project, (100 * 2) / 3);

    // 0.50*100 + 0.25*75 + 0.10*100 + 0.15*(200/3) = 50 + 18.75 + 10 + 10 = 88.75
    assert.equal(analysis.total_score, 88.75);
    assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.HIGH);
  });

  await t.test('19. Test Vector SC-V03 (MEDIUM): 75, 50, 100, 50 -> 67.5 MEDIUM', () => {
    const candidate = {
      _id: 'candidate:cms:R_000001',
      skills: ['python', 'sql', 'docker'], // 3 of 4
      profile: { experience_months: 24 }, // 24 of 48 -> 50
      education: [{ degree: 'BACHELOR' }], // 100
      projects: [{ technologies: ['node.js'] }], // 1 of 2 -> 50
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.AVAILABLE,
      },
    };

    const job = {
      _id: 'job:cms:J_000001',
      required_skills: ['python', 'sql', 'docker', 'git'],
      requirements: {
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 48 },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['node.js', 'docker'] },
      },
    };

    const analysis = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-22T12:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.COMPLETE);
    // 0.50*75 + 0.25*50 + 0.10*100 + 0.15*50 = 37.5 + 12.5 + 10 + 7.5 = 67.5
    assert.equal(analysis.total_score, 67.5);
    assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.MEDIUM);
  });

  await t.test('20. Test Vector SC-V01 (LOW boundary): 0, 0, 0, 0 -> 0 LOW', () => {
    const candidate = {
      _id: 'candidate:cms:R_000001',
      skills: [],
      profile: { experience_months: 0 },
      education: [{ degree: 'HIGH_SCHOOL' }],
      projects: [],
      data_availability: {
        skills: AVAILABILITY_STATES.NONE_DECLARED,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.NONE_DECLARED,
      },
    };

    const job = {
      _id: 'job:cms:J_000001',
      required_skills: ['python'],
      requirements: {
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 12 },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['docker'] },
      },
    };

    const analysis = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-22T12:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.COMPLETE);
    assert.equal(analysis.total_score, 0);
    assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.LOW);
  });

  await t.test('21. INCOMPLETE when any component is missing: omits total_score and recommendation', () => {
    const candidate = {
      _id: 'candidate:cms:R_000001',
      skills: ['python'],
      profile: { experience_months: 24 },
      education: [{ degree: 'BACHELOR' }],
      projects: [],
      data_availability: {
        skills: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.AVAILABLE,
        education: AVAILABILITY_STATES.AVAILABLE,
        projects: AVAILABILITY_STATES.UNAVAILABLE, // Missing!
      },
    };

    const job = {
      _id: 'job:cms:J_000001',
      required_skills: ['python'],
      requirements: {
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 24 },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['docker'] },
      },
    };

    const analysis = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-22T12:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.INCOMPLETE);
    assert.equal(analysis.total_score, undefined);
    assert.equal(analysis.recommendation, undefined);
    assert.equal(analysis.scores.skill, 100);
    assert.equal(analysis.scores.project, null);
    assert.equal(analysis.missing_inputs.length, 1);
    assert.equal(analysis.missing_inputs[0].code, 'CANDIDATE_PROJECTS_UNAVAILABLE');
  });

  await t.test('TV3-UC19-003: missing availability makes analysis INCOMPLETE without aggregate output', () => {
    const candidate = {
      _id: 'candidate:cms:R_000001',
      skills: ['python'],
      profile: { experience_months: 24 },
      education: [{ degree: 'BACHELOR' }],
      projects: [{ technologies: ['docker'] }],
    };
    const job = {
      _id: 'job:cms:J_000001',
      required_skills: ['python'],
      requirements: {
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 24 },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['docker'] },
      },
    };

    const analysis = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-25T06:30:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.INCOMPLETE);
    assert.deepEqual(analysis.scores, {
      skill: null,
      experience: null,
      education: null,
      project: null,
    });
    assert.equal(analysis.total_score, undefined);
    assert.equal(analysis.recommendation, undefined);
    assert.deepEqual(
      analysis.missing_inputs.map((item) => item.code),
      [
        'MISSING_CANDIDATE_SKILLS_AVAILABILITY',
        'MISSING_CANDIDATE_EXPERIENCE_AVAILABILITY',
        'MISSING_CANDIDATE_EDUCATION_AVAILABILITY',
        'MISSING_CANDIDATE_PROJECTS_AVAILABILITY',
      ],
    );
  });

  await t.test('TV3-UC19-003: empty evidence without availability is deterministic and INCOMPLETE', () => {
    const candidate = {
      _id: 'candidate:cms:R_000001',
      skills: [],
      profile: {},
      education: [],
      projects: [],
    };
    const job = {
      _id: 'job:cms:J_000001',
      required_skills: ['python'],
      requirements: {
        experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 12 },
        education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
        project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['docker'] },
      },
    };
    const first = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-25T06:30:00Z',
    });
    const second = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-25T06:30:00Z',
    });

    assert.equal(first.analysis_status, ANALYSIS_STATUSES.INCOMPLETE);
    assert.equal(first.total_score, undefined);
    assert.equal(first.recommendation, undefined);
    assert.equal(first.input_fingerprint, second.input_fingerprint);
    assert.deepEqual(first, second);
  });
});

test('TV3-UC19-005: Component Availability & Provenance Context', async (t) => {
  const application = {
    _id: 'application:pair:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };
  const candidateProvenance = {
    classification: PROVENANCE_CLASSIFICATIONS.MIXED,
    source_dataset: 'test-candidate-source',
    field_origins: { skills: 'source', projects: 'synthetic' },
  };
  const jobProvenance = {
    classification: PROVENANCE_CLASSIFICATIONS.MIXED,
    generator_seed: 'job-test-seed',
    generator_version: 'job-test-v1',
    field_origins: { 'requirements.project': 'synthetic' },
  };
  const candidate = {
    _id: 'candidate:cms:R_000001',
    skills: [{ name: 'NodeJS', normalized: 'node.js' }],
    profile: { experience_months: 24 },
    education: [{ degree: 'BACHELOR' }],
    projects: [
      {
        name: 'Synthetic API',
        technologies: [' React.js ', 'NodeJS'],
        is_synthetic: true,
        provenance: {
          classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
          generator_seed: 'project-seed',
          generator_version: 'project-v1',
        },
      },
      {
        name: 'Declared CLI',
        technologies: ['Docker', 'node.js'],
      },
    ],
    data_availability: {
      skills: AVAILABILITY_STATES.AVAILABLE,
      experience: AVAILABILITY_STATES.PARTIAL,
      education: AVAILABILITY_STATES.PARTIAL,
      projects: AVAILABILITY_STATES.SYNTHETIC,
    },
    provenance: candidateProvenance,
  };
  const job = {
    _id: 'job:cms:J_000001',
    required_skills: ['node.js'],
    requirements: {
      experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 24 },
      education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
      project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['node.js'] },
    },
    provenance: jobProvenance,
  };

  await t.test('new evaluator emits all four exact availability/provenance contexts without changing scores', () => {
    const analysis = evaluateResumeAnalysis({
      application,
      candidate,
      job,
      analyzedAt: '2026-10-25T07:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.COMPLETE);
    assert.deepEqual(analysis.scores, {
      skill: 100,
      experience: 100,
      education: 100,
      project: 100,
    });
    assert.equal(analysis.total_score, 100);
    assert.equal(analysis.recommendation, RECOMMENDATION_LEVELS.HIGH);

    assert.deepEqual(
      Object.fromEntries(Object.entries(analysis.component_details).map(([name, details]) => [
        name,
        details.input_context.candidate_availability,
      ])),
      {
        skill: AVAILABILITY_STATES.AVAILABLE,
        experience: AVAILABILITY_STATES.PARTIAL,
        education: AVAILABILITY_STATES.PARTIAL,
        project: AVAILABILITY_STATES.SYNTHETIC,
      },
    );
    for (const details of Object.values(analysis.component_details)) {
      assert.deepEqual(details.input_context.candidate_provenance, candidateProvenance);
      assert.deepEqual(details.input_context.job_provenance, jobProvenance);
    }
    assert.equal(resumeAnalysisDocumentSchema.safeParse(analysis).success, true);
  });

  await t.test('project evidence keeps canonical technologies and real item provenance in deterministic order', () => {
    const first = evaluateResumeAnalysis({
      application,
      candidate,
      job,
      analyzedAt: '2026-10-25T07:00:00Z',
    });
    const reorderedCandidate = {
      ...candidate,
      projects: [
        { ...candidate.projects[1], technologies: ['node.js', 'Docker'] },
        { ...candidate.projects[0], technologies: ['NodeJS', 'React.js'] },
      ],
    };
    const second = evaluateResumeAnalysis({
      application,
      candidate: reorderedCandidate,
      job,
      analyzedAt: '2026-10-25T07:00:00Z',
    });

    const evidence = first.component_details.project.input_context.candidate_project_evidence;
    assert.deepEqual(evidence, second.component_details.project.input_context.candidate_project_evidence);
    assert.deepEqual(evidence.map((item) => item.technologies), [
      ['docker', 'node.js'],
      ['node.js', 'react'],
    ]);
    assert.equal(evidence[0].is_synthetic, null);
    assert.equal(evidence[0].provenance, null);
    assert.equal(evidence[1].is_synthetic, true);
    assert.deepEqual(evidence[1].provenance, candidate.projects[0].provenance);
    assert.deepEqual(first, second);
  });

  await t.test('missing metadata remains null and cannot create aggregate output', () => {
    const candidateWithoutMetadata = {
      _id: candidate._id,
      skills: candidate.skills,
      profile: candidate.profile,
      education: candidate.education,
      projects: [],
    };
    const jobWithoutProvenance = { ...job, provenance: undefined };
    const analysis = evaluateResumeAnalysis({
      application,
      candidate: candidateWithoutMetadata,
      job: jobWithoutProvenance,
      analyzedAt: '2026-10-25T07:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.INCOMPLETE);
    assert.equal(analysis.total_score, undefined);
    assert.equal(analysis.recommendation, undefined);
    for (const details of Object.values(analysis.component_details)) {
      assert.equal(details.input_context.candidate_availability, null);
      assert.equal(details.input_context.candidate_provenance, null);
      assert.equal(details.input_context.job_provenance, null);
    }
    assert.deepEqual(
      analysis.component_details.project.input_context.candidate_project_evidence,
      [],
    );
    assert.equal(resumeAnalysisDocumentSchema.safeParse(analysis).success, true);
  });

  await t.test('NONE_DECLARED and UNAVAILABLE remain distinct in component contexts', () => {
    const explicitCandidate = {
      ...candidate,
      skills: [],
      education: [],
      projects: [],
      data_availability: {
        skills: AVAILABILITY_STATES.NONE_DECLARED,
        experience: AVAILABILITY_STATES.UNAVAILABLE,
        education: AVAILABILITY_STATES.NONE_DECLARED,
        projects: AVAILABILITY_STATES.UNAVAILABLE,
      },
    };
    const analysis = evaluateResumeAnalysis({
      application,
      candidate: explicitCandidate,
      job,
      analyzedAt: '2026-10-25T07:00:00Z',
    });

    assert.equal(analysis.analysis_status, ANALYSIS_STATUSES.INCOMPLETE);
    assert.equal(
      analysis.component_details.skill.input_context.candidate_availability,
      AVAILABILITY_STATES.NONE_DECLARED,
    );
    assert.equal(
      analysis.component_details.experience.input_context.candidate_availability,
      AVAILABILITY_STATES.UNAVAILABLE,
    );
    assert.equal(
      analysis.component_details.education.input_context.candidate_availability,
      AVAILABILITY_STATES.NONE_DECLARED,
    );
    assert.equal(
      analysis.component_details.project.input_context.candidate_availability,
      AVAILABILITY_STATES.UNAVAILABLE,
    );
    assert.equal(analysis.total_score, undefined);
    assert.equal(analysis.recommendation, undefined);
  });

  await t.test('component metadata does not alter fingerprint and legacy metadata omission remains fresh', () => {
    const analysis = evaluateResumeAnalysis({
      application,
      candidate,
      job,
      analyzedAt: '2026-10-25T07:00:00Z',
    });
    const legacyAnalysis = structuredClone(analysis);
    for (const details of Object.values(legacyAnalysis.component_details)) {
      delete details.input_context;
    }

    assert.equal(resumeAnalysisDocumentSchema.safeParse(legacyAnalysis).success, true);
    assert.equal(legacyAnalysis.input_fingerprint, analysis.input_fingerprint);
    assert.equal(isAnalysisFresh(legacyAnalysis, candidate, job), true);
  });
});

test('DATA-03.4A: Input Fingerprint & Freshness Acceptance Tests', async (t) => {
  const candidate = {
    _id: 'candidate:cms:R_000001',
    name: 'Alice Developer',
    skills: ['python', 'docker', 'sql'],
    profile: { experience_months: 36 },
    education: [{ degree: 'BACHELOR' }],
    projects: [{
      name: 'Commerce API',
      description: 'Display-only project description',
      technologies: ['react', 'node.js'],
      is_synthetic: true,
      provenance: {
        classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
        generator_seed: 'fingerprint-fixture',
        generator_version: 'test-v1',
      },
    }],
    data_availability: {
      skills: AVAILABILITY_STATES.AVAILABLE,
      experience: AVAILABILITY_STATES.AVAILABLE,
      education: AVAILABILITY_STATES.AVAILABLE,
      projects: AVAILABILITY_STATES.AVAILABLE,
    },
  };

  const job = {
    _id: 'job:cms:J_000001',
    title: 'Senior Software Engineer',
    required_skills: ['sql', 'python', 'docker'],
    requirements: {
      experience: { status: REQUIREMENT_STATUSES.EXPERIENCE.REQUIRED, required_months: 36 },
      education: { status: REQUIREMENT_STATUSES.EDUCATION.REQUIRED, minimum_degree: 'BACHELOR' },
      project: { status: REQUIREMENT_STATUSES.PROJECT.REQUIRED, required_technologies: ['node.js'] },
    },
  };

  await t.test('22. Deterministic fingerprint: same inputs produce identical 64-hex SHA-256', () => {
    const fp1 = computeInputFingerprint({ candidate, job });
    const fp2 = computeInputFingerprint({ candidate, job });
    assert.equal(fp1, fp2);
    assert.match(fp1, /^[a-f0-9]{64}$/);
  });

  await t.test('23. Reordered skills set preserves fingerprint', () => {
    const candidateReordered = {
      ...candidate,
      skills: ['sql', 'docker', 'python'], // Reordered
    };
    const fp1 = computeInputFingerprint({ candidate, job });
    const fp2 = computeInputFingerprint({ candidate: candidateReordered, job });
    assert.equal(fp1, fp2);
  });

  await t.test('24. Display-only change (name/title) does not invalidate freshness', () => {
    const candidateRenamed = {
      ...candidate,
      name: 'Bob Developer (Renamed)',
    };
    const fp1 = computeInputFingerprint({ candidate, job });
    const fp2 = computeInputFingerprint({ candidate: candidateRenamed, job });
    assert.equal(fp1, fp2);
  });

  await t.test('25. Scoring-relevant change (adding skill) invalidates freshness', () => {
    const candidateWithSkill = {
      ...candidate,
      skills: [...candidate.skills, 'kubernetes'],
    };
    const fp1 = computeInputFingerprint({ candidate, job });
    const fp2 = computeInputFingerprint({ candidate: candidateWithSkill, job });
    assert.notEqual(fp1, fp2);
  });

  await t.test('26. Freshness helper checks input consistency', () => {
    const dummyApp = { _id: 'application:pair:test1' };
    const analysis = evaluateResumeAnalysis({
      application: dummyApp,
      candidate,
      job,
      analyzedAt: '2026-10-22T10:00:00Z',
    });

    assert.equal(isAnalysisFresh(analysis, candidate, job), true);

    const changedCandidate = { ...candidate, skills: ['python'] };
    assert.equal(isAnalysisFresh(analysis, changedCandidate, job), false);
  });

  await t.test('27. Normalization and degree mapping version changes invalidate fingerprint', () => {
    const baseline = computeInputFingerprint({ candidate, job });
    const changedSkillVersion = computeInputFingerprint({
      candidate,
      job,
      skillNormalizationVersion: `${SKILL_NORMALIZATION_VERSION}-changed`,
    });
    const changedDegreeVersion = computeInputFingerprint({
      candidate,
      job,
      degreeMappingVersion: `${DEGREE_MAPPING_VERSION}-changed`,
    });

    assert.notEqual(baseline, changedSkillVersion);
    assert.notEqual(baseline, changedDegreeVersion);
  });

  await t.test('28. Project provenance changes invalidate fingerprint', () => {
    const changedProvenance = {
      ...candidate,
      projects: [{
        ...candidate.projects[0],
        provenance: {
          ...candidate.projects[0].provenance,
          generator_version: 'test-v2',
        },
      }],
    };

    assert.notEqual(
      computeInputFingerprint({ candidate, job }),
      computeInputFingerprint({ candidate: changedProvenance, job }),
    );
  });

  await t.test('29. Project and technology order do not affect fingerprint', () => {
    const secondProject = {
      name: 'Worker',
      technologies: ['docker', 'python'],
      provenance: {
        generator_version: 'test-v1',
        classification: PROVENANCE_CLASSIFICATIONS.SYNTHETIC,
        generator_seed: 'second-fixture',
      },
      is_synthetic: true,
    };
    const ordered = { ...candidate, projects: [candidate.projects[0], secondProject] };
    const reordered = {
      ...candidate,
      projects: [
        { ...secondProject, technologies: ['python', 'docker'] },
        { ...candidate.projects[0], technologies: ['node.js', 'react'] },
      ],
    };

    assert.equal(
      computeInputFingerprint({ candidate: ordered, job }),
      computeInputFingerprint({ candidate: reordered, job }),
    );
  });

  await t.test('30. Project display-only fields do not affect fingerprint', () => {
    const displayOnlyChange = {
      ...candidate,
      projects: [{
        ...candidate.projects[0],
        name: 'Renamed project',
        description: 'Updated display-only description',
        role: 'Lead Engineer',
      }],
    };

    assert.equal(
      computeInputFingerprint({ candidate, job }),
      computeInputFingerprint({ candidate: displayOnlyChange, job }),
    );
  });

  await t.test('TV3-UC19-003: missing availability is deterministic and differs from explicit AVAILABLE', () => {
    const { data_availability: _omitted, ...candidateWithoutAvailability } = candidate;
    const missingFirst = computeInputFingerprint({ candidate: candidateWithoutAvailability, job });
    const missingSecond = computeInputFingerprint({ candidate: candidateWithoutAvailability, job });
    const explicitAvailable = computeInputFingerprint({ candidate, job });

    assert.equal(missingFirst, missingSecond);
    assert.notEqual(missingFirst, explicitAvailable);
  });
});

test('DATA-03.4A: Deterministic per-Job Candidate Ranking Acceptance Tests', async (t) => {
  const jobId = 'job:cms:J_000001';

  // 4 applications
  const app1 = { _id: 'application:pair:0001', job_id: jobId, applied_at: '2026-10-22T08:00:00Z', current_stage: APPLICATION_STAGES.APPLIED };
  const app2 = { _id: 'application:pair:0002', job_id: jobId, applied_at: '2026-10-22T09:00:00Z', current_stage: APPLICATION_STAGES.SCREENING };
  const app3 = { _id: 'application:pair:0003', job_id: jobId, applied_at: '2026-10-22T07:00:00Z', current_stage: APPLICATION_STAGES.INTERVIEW };
  const appWithdrawn = { _id: 'application:pair:0004', job_id: jobId, applied_at: '2026-10-22T06:00:00Z', current_stage: APPLICATION_STAGES.WITHDRAWN };

  const appsMap = new Map([
    [app1._id, app1],
    [app2._id, app2],
    [app3._id, app3],
    [appWithdrawn._id, appWithdrawn],
  ]);

  const analysis1 = {
    _id: `analysis:${app1._id}`,
    application_id: app1._id,
    job_id: jobId,
    analysis_status: ANALYSIS_STATUSES.COMPLETE,
    total_score: 85.0,
    scores: { skill: 90 },
  };

  const analysis2 = {
    _id: `analysis:${app2._id}`,
    application_id: app2._id,
    job_id: jobId,
    analysis_status: ANALYSIS_STATUSES.COMPLETE,
    total_score: 85.0, // Same total score!
    scores: { skill: 80 }, // Lower skill score -> should rank below app1
  };

  const analysis3 = {
    _id: `analysis:${app3._id}`,
    application_id: app3._id,
    job_id: jobId,
    analysis_status: ANALYSIS_STATUSES.COMPLETE,
    total_score: 95.0, // Highest total score -> rank 1
    scores: { skill: 95 },
  };

  const analysisIncomplete = {
    _id: 'analysis:application:pair:inc',
    application_id: 'application:pair:inc',
    job_id: jobId,
    analysis_status: ANALYSIS_STATUSES.INCOMPLETE,
    scores: { skill: 100 },
  };

  await t.test('27. Ranking filters out INCOMPLETE and WITHDRAWN, ranks by total_score DESC then skill DESC', () => {
    const ranked = rankAnalyses([analysis1, analysis2, analysis3, analysisIncomplete], appsMap, { jobId, mode: 'ACTIVE' });

    assert.equal(ranked.length, 3, 'INCOMPLETE must be excluded');
    assert.equal(ranked[0].application._id, app3._id); // 95.0
    assert.equal(ranked[0].rank, 1);

    assert.equal(ranked[1].application._id, app1._id); // 85.0 with skill 90
    assert.equal(ranked[1].rank, 2);

    assert.equal(ranked[2].application._id, app2._id); // 85.0 with skill 80
    assert.equal(ranked[2].rank, 3);
  });

  await t.test('28. Tie-breaker 3 & 4: applied_at ASC then application._id ASC', () => {
    // Two analyses with identical total_score (80) and identical skill score (80)
    const appA = { _id: 'application:pair:bbbb', job_id: jobId, applied_at: '2026-10-22T10:00:00Z', current_stage: APPLICATION_STAGES.APPLIED };
    const appB = { _id: 'application:pair:aaaa', job_id: jobId, applied_at: '2026-10-22T10:00:00Z', current_stage: APPLICATION_STAGES.APPLIED };

    const tieAppsMap = new Map([
      [appA._id, appA],
      [appB._id, appB],
    ]);

    const anA = { _id: `analysis:${appA._id}`, application_id: appA._id, job_id: jobId, analysis_status: ANALYSIS_STATUSES.COMPLETE, total_score: 80, scores: { skill: 80 } };
    const anB = { _id: `analysis:${appB._id}`, application_id: appB._id, job_id: jobId, analysis_status: ANALYSIS_STATUSES.COMPLETE, total_score: 80, scores: { skill: 80 } };

    const ranked = rankAnalyses([anA, anB], tieAppsMap, { jobId });
    // Identical total, skill, applied_at -> application._id 'aaaa' comes before 'bbbb'
    assert.equal(ranked[0].application._id, 'application:pair:aaaa');
    assert.equal(ranked[1].application._id, 'application:pair:bbbb');
  });

  await t.test('29. Ranking is strictly scoped per Job: does not mix jobs', () => {
    const otherJobAnalysis = {
      _id: 'analysis:app_other',
      application_id: 'app_other',
      job_id: 'job:cms:J_999999', // Different job
      analysis_status: ANALYSIS_STATUSES.COMPLETE,
      total_score: 100,
      scores: { skill: 100 },
    };

    const ranked = rankAnalyses([analysis1, otherJobAnalysis], appsMap, { jobId });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].analysis._id, analysis1._id);
  });
});
