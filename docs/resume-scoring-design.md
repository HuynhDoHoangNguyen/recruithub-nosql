# DATA-02A — Resume Scoring Design

## 1. Final design status

This document is the approved, explainable MVP scoring contract for DATA-02B.

| Label | Meaning |
|---|---|
| `EXISTING_PHASE3` | Retained Phase 3 formula or threshold |
| `APPROVED_MVP` | Locked by the DATA-02A Final Design Lock |
| `REJECTED_MVP` | Reviewed scoring alternative that must not be implemented |

Hard constraints:

- Scores are deterministic business rules, not AI/LLM output.
- Ground-truth Resume–Job pairs are evaluation labels only; they never create Applications or determine a component, total, recommendation or rank.
- A missing input is never replaced with random, zero, mean, median or another default.
- No `total_score`, recommendation or ranking exists unless all four component scores are valid.
- Synthetic demo inputs remain labeled synthetic at field/item level; source-only missing input stays `UNAVAILABLE`.
- Intermediate values used for totals and ranking are not rounded. Rounding is display-only.

## 2. Approved scoring configuration

| Configuration item | Approved value | Status |
|---|---|---|
| Configuration ID | `recruithub-scoring-mvp-v1` | `APPROVED_MVP` |
| Skill formula | Required-skill coverage | `APPROVED_MVP` |
| Optional skills | Ignored | `APPROVED_MVP` |
| Experience formula ID | `EXP-A` continuous capped ratio | `APPROVED_MVP` |
| Education formula ID | `EDU-B` binary minimum qualification | `APPROVED_MVP` |
| Project formula ID | `PROJ-A` required-technology coverage | `APPROVED_MVP` |
| Missing component | Persist `INCOMPLETE`; no total/recommendation/ranking | `APPROVED_MVP` |
| Aggregate weights | Skill 0.50, Experience 0.25, Education 0.10, Project 0.15 | `EXISTING_PHASE3` |
| Recommendation thresholds | HIGH ≥80; MEDIUM ≥60 and <80; LOW <60 | `EXISTING_PHASE3` |
| Threshold comparison | Unrounded total | `APPROVED_MVP` |
| Ranking values | Unrounded total, then unrounded Skill Score | `APPROVED_MVP` |

Any formula, alias table, degree mapping or score-relevant normalization change requires a new version. The active implementation must not reuse `recruithub-scoring-mvp-v1` for changed behavior.

## 3. Input classification and canonical paths

| Input | Canonical path | Audited source status | Classification |
|---|---|---|---|
| Candidate skills | `candidate.skills[].normalized` | Available | `source` + `normalized` |
| Job required skills | `job.required_skills[]` | Available | `source` + `normalized` |
| Job optional skills | `job.optional_skills[]` | Available | `source` + `normalized` |
| Candidate experience | `candidate.profile.experience_months` | Years available | months `derived` from source |
| Job required experience | `job.requirements.experience` | Missing from source | user-entered/`synthetic` or `unavailable` |
| Candidate education | `candidate.education[].degree` | Scalar degree available | `source` + `normalized`, partial |
| Job required education | `job.requirements.education` | Missing from source | user-entered/`synthetic` or `unavailable` |
| Candidate projects | `candidate.projects[]` | Missing from source | user-entered/`synthetic` or `unavailable` |
| Job project requirement | `job.requirements.project` | Missing from source | user-entered/`synthetic` or `unavailable` |
| Ground-truth pair | External evaluation label | Available | prohibited score/Application input |

Availability/provenance metadata distinguishes `NONE_DECLARED` from `UNAVAILABLE` and `SYNTHETIC`. An empty array without an availability state is ambiguous and invalid for scoring.

## 4. Normalization

Before scoring:

1. Validate Candidate, Job and Application references.
2. Validate availability states and conditional requirement fields.
3. Trim strings, lowercase skills, collapse internal whitespace and apply the versioned alias table.
4. Remove normalized duplicates while preserving deterministic explanation order.
5. Require required/optional skill sets to be disjoint.
6. Convert audited integer years to months using `years × 12`.
7. Normalize degrees using the approved demo mapping.
8. Normalize project technologies with the same skill-normalization policy.
9. Record exact inputs, formula ID, availability, provenance and unrounded result in `component_details`.

## 5. Skill Score — required-skill coverage

Status: `APPROVED_MVP`.

```text
required = unique(normalize(job.required_skills))
candidate = unique(normalize(candidate.skills))
matched = required ∩ candidate
missing = required − candidate

SkillScore = 100 × |matched| / |required|
```

Rules:

- `required` must be non-empty. Missing/empty required skills make analysis `INCOMPLETE` with invalid Job configuration.
- Optional skills contribute zero.
- Candidate skills `UNAVAILABLE` make the component missing.
- Candidate skills `NONE_DECLARED` with a non-empty required set produce Skill Score 0.

Example:

```text
Required:  [python, sql, docker, git]
Candidate: [python, docker, git, excel]
Matched:   [python, docker, git]       → 3
Missing:   [sql]                       → 1

SkillScore = 100 × 3 / 4 = 75
```

Optional `excel` contributes zero.

## 6. Experience Score — EXP-A

Status: `APPROVED_MVP`.

Canonical inputs:

- `candidate.profile.experience_months`.
- `job.requirements.experience.status`.
- `job.requirements.experience.required_months` when status is `REQUIRED`.

```text
if status == NO_MINIMUM:
    ExperienceScore = 100
else if status == REQUIRED:
    ExperienceScore = min(
        100,
        100 × candidate_months / required_months
    )
else if status == UNAVAILABLE:
    ExperienceScore = missing
```

For `REQUIRED`, `required_months` must be a positive integer. Candidate months must be a non-negative integer with valid availability/provenance.

Examples:

```text
Candidate 36 months, Job REQUIRED 48 months:
ExperienceScore = min(100, 100 × 36/48)
                = 75

Candidate 60 months, Job REQUIRED 48 months:
ExperienceScore = min(100, 100 × 60/48)
                = min(100, 125)
                = 100

Job NO_MINIMUM:
ExperienceScore = 100
```

Missing Candidate months or `UNAVAILABLE` Job requirement produces no Experience Score and makes analysis `INCOMPLETE`, for example with `MISSING_JOB_EXPERIENCE_REQUIREMENT`. Required months must not be inferred from Job seniority without a separately approved, versioned generation rule.

`REJECTED_MVP`: EXP-B band scores 0/25/50/75/100. It introduces threshold cliffs and is less granular than the approved monotonic ratio.

## 7. Education Score — EDU-B

Status: `APPROVED_MVP`.

Approved demo degree normalization:

| Canonical value | Rank |
|---|---:|
| `HIGH_SCHOOL` | 1 |
| `BACHELOR` (`BA`, `BSc`) | 2 |
| `MASTER` (`MSc`, `MBA`) | 3 |
| `DOCTORATE` | 4 |

BA/BSc share Bachelor rank and MSc/MBA share Master rank only for this simple demo scoring rule. School prestige, institution and major are not scored.

Canonical inputs:

- normalized Candidate degree evidence in `candidate.education[].degree`;
- `job.requirements.education.status`;
- `job.requirements.education.minimum_degree` when status is `REQUIRED`.

```text
if status == NO_MINIMUM:
    EducationScore = 100
else if status == REQUIRED
        and candidate_rank >= minimum_degree_rank:
    EducationScore = 100
else if status == REQUIRED:
    EducationScore = 0
else if status == UNAVAILABLE:
    EducationScore = missing
```

Examples:

```text
Candidate BSc rank 2, Job REQUIRED MSc rank 3:
2 < 3 → EducationScore = 0

Candidate MSc rank 3, Job REQUIRED BSc rank 2:
3 >= 2 → EducationScore = 100

Job NO_MINIMUM:
EducationScore = 100
```

Candidate education or Job requirement `UNAVAILABLE` produces no Education Score and makes analysis `INCOMPLETE`. A minimum degree must not be inferred from seniority.

`REJECTED_MVP`: EDU-A ordinal-distance scoring with 60 points for a one-rank shortfall. The MVP uses a transparent minimum qualification and rejects arbitrary partial credit.

## 8. Project Score — PROJ-A

Status: `APPROVED_MVP`.

Canonical inputs:

- `candidate.projects[].technologies[]` and project availability;
- `job.requirements.project.status`;
- `job.requirements.project.required_technologies[]` when status is `REQUIRED`.

```text
if status == NO_REQUIREMENT:
    ProjectScore = 100
else if status == REQUIRED:
    required_tech = unique(normalize(
        job.requirements.project.required_technologies
    ))
    candidate_tech = union of unique normalized technologies
                     across candidate.projects

    ProjectScore =
        100 × |required_tech ∩ candidate_tech| / |required_tech|
else if status == UNAVAILABLE:
    ProjectScore = missing
```

For `REQUIRED`, `required_tech` must be non-empty.

Example:

```text
Required technologies:  [node.js, couchdb, docker]
Candidate technologies: [node.js, docker, react]
Matched:                 [node.js, docker] → 2 of 3

ProjectScore = 100 × 2/3
             = 66.666...
Display      = 66.67
```

Availability behavior:

- Candidate projects `NONE_DECLARED` and Job `REQUIRED` produce Project Score 0.
- Candidate projects `UNAVAILABLE` produce no Project Score and analysis `INCOMPLETE`.
- Job `NO_REQUIREMENT` produces Project Score 100.
- Job `UNAVAILABLE` produces no Project Score and analysis `INCOMPLETE`.

`REJECTED_MVP`: PROJ-B hybrid technology coverage/project-count formula. It needs extra synthetic project-count requirements and an arbitrary relevance threshold.

## 9. Aggregate, recommendation and rounding

Status: aggregate weights and thresholds are `EXISTING_PHASE3`; unrounded comparison is `APPROVED_MVP`.

```text
TotalScore = 0.50 × SkillScore
           + 0.25 × ExperienceScore
           + 0.10 × EducationScore
           + 0.15 × ProjectScore
```

```text
0.50 + 0.25 + 0.10 + 0.15 = 1.00
```

| Recommendation | Unrounded TotalScore |
|---|---|
| `HIGH` | `>= 80` |
| `MEDIUM` | `>= 60` and `< 80` |
| `LOW` | `< 60` |

Calculation rules:

1. All four scores must be finite and within `[0,100]`.
2. Preserve unrounded component calculations through the weighted sum.
3. Compare the unrounded total to recommendation thresholds.
4. Use unrounded total and Skill Score for ranking.
5. Round to two decimals only when formatting a display value.
6. Store inputs/numerators/denominators in `component_details` so calculations are reproducible.

## 10. Missing inputs and INCOMPLETE

Status: `APPROVED_MVP`.

If any required component input is missing or invalid, persist an explainable `INCOMPLETE` analysis:

```json
{
  "analysis_status": "INCOMPLETE",
  "scores": {
    "skill": 75,
    "experience": null,
    "education": null,
    "project": null
  },
  "missing_inputs": [
    {
      "component": "experience",
      "code": "MISSING_JOB_EXPERIENCE_REQUIREMENT"
    },
    {
      "component": "project",
      "code": "CANDIDATE_PROJECTS_UNAVAILABLE"
    }
  ]
}
```

For `INCOMPLETE`:

- `total_score` is omitted.
- `recommendation` is omitted.
- Active and historical ranking exclude it.
- Valid component explanations may be retained.
- Missing component scores are null/omitted, never fabricated as zero.
- Re-analysis is allowed after inputs become available or configuration changes.

`REJECTED_MVP`: reject analysis creation entirely. It loses diagnostics and traceability.

## 11. Synthetic scoring data

Status: `APPROVED_MVP`.

- Demo Job requirements may be synthetic with field-level classification, seed and generator version.
- Candidate projects may be synthetic only for labeled demo scenarios and carry item-level provenance.
- Prefer deriving synthetic project technologies from audited Candidate skills, but the existence of the project remains a synthetic claim.
- UI/reporting must not describe synthetic projects or scores as observed real-world capability.
- Do not add source Candidate skills to improve a score.
- Source-only analysis remains `INCOMPLETE` where Experience/Education/Project requirements or evidence are unavailable.
- Demo behavior does not establish predictive validity.

Example project:

```json
{
  "name": "Demo Project 01",
  "technologies": ["node.js", "docker"],
  "summary": "Synthetic demo evidence",
  "provenance": {
    "classification": "synthetic",
    "generator_version": "<version>",
    "seed": "recruithub:data:v1:20261021"
  }
}
```

## 12. Freshness and invalidation

### 12.1. Fingerprint payload

Create a canonical payload containing only:

- Candidate normalized skills.
- Candidate experience months and availability state.
- Candidate normalized education evidence and availability state.
- Candidate normalized project technologies and provenance/availability state.
- Job required skills.
- Job Experience/Education/Project requirement states and values.
- Skill alias/normalization version.
- Degree mapping version.
- Component formula IDs, weights and threshold configuration version.

Sort unordered sets, serialize canonically, encode as UTF-8 and hash with SHA-256. Store the lowercase hexadecimal hash as `input_fingerprint`.

### 12.2. Freshness

Analysis is fresh only when:

- stored fingerprint equals a freshly computed fingerprint;
- stored `algorithm_version` equals the active approved configuration;
- Application still references the same Candidate and Job.

Display-only changes such as Candidate name do not invalidate analysis. Any scoring input, availability/provenance classification, alias/mapping, formula, weight or threshold change does. Application stage does not change component scores but can change ranking eligibility.

On stale detection:

- do not return the old result as current;
- exclude it from ranking;
- explicitly re-analyze or report stale until recomputation;
- update `analysis:<application_id>` using current `_rev`;
- on `409`, re-read and never overwrite a newer valid analysis.

## 13. Ranking contract

Ranking is always scoped to one Job and includes only fresh `COMPLETE` analyses.

Active ranking includes `APPLIED`, `SCREENING`, `INTERVIEW` and `OFFER`. Historical ranking is a separate API/mode that may include `HIRED` and `REJECTED`. `WITHDRAWN` is excluded by default.

Stable order:

1. `resume_analysis.total_score DESC`, unrounded.
2. `resume_analysis.scores.skill DESC`, unrounded.
3. `application.applied_at ASC`.
4. `application._id ASC`.

## 14. Approved numeric test vectors

All totals below were independently recomputed from the four displayed component inputs using the fixed weighted formula.

| ID | Scenario | Skill | Experience | Education | Project | Exact total / result | Expected |
|---|---|---:|---:|---:|---:|---|---|
| SC-V01 | Score 0 | 0 | 0 | 0 | 0 | `0.50×0 + 0.25×0 + 0.10×0 + 0.15×0 = 0` | `0 / LOW` |
| SC-V02 | Score 100 | 100 | 100 | 100 | 100 | `50 + 25 + 10 + 15 = 100` | `100 / HIGH` |
| SC-V03 | MEDIUM | 75 | 50 | 100 | 50 | `37.5 + 12.5 + 10 + 7.5 = 67.5` | `67.5 / MEDIUM` |
| SC-V04 | HIGH | 100 | 75 | 100 | 200/3 | `50 + 18.75 + 10 + 10 = 88.75` | `88.75 / HIGH` |
| SC-V05 | Project evidence unavailable | 75 | 75 | 100 | missing | No aggregate is evaluated | `INCOMPLETE`; no total/recommendation/rank |
| SC-V06 | Explicit no minimum/requirement | 50 | 100 | 100 | 100 | `25 + 25 + 10 + 15 = 75` | `75 / MEDIUM` |
| SC-V07 | Job experience requirement unavailable | 100 | missing | 100 | 100 | No aggregate is evaluated | `INCOMPLETE`; no total/recommendation/rank |
| SC-V08 | Score input changes | Previous fingerprint `F1`; Candidate skill set changes | — | — | — | recomputed fingerprint `F2 != F1` | stale; exclude until re-analysis |

Input derivations:

### SC-V01 — component zero boundaries

```text
Skill: Candidate NONE_DECLARED, Job has required skills       → 0
Experience: Candidate 0 months, Job REQUIRED 12 months        → 0
Education: HIGH_SCHOOL rank 1, Job REQUIRED BACHELOR rank 2   → 0
Project: Candidate projects NONE_DECLARED, Job REQUIRED       → 0
Total = 0
```

### SC-V02 — component maximum boundaries

```text
Skill: all required skills matched                 → 100
Experience: 60 months / REQUIRED 48 months, capped → 100
Education: MASTER >= required BACHELOR             → 100
Project: all required technologies matched         → 100
Total = 100
```

### SC-V03 — MEDIUM

```text
Skill: 3/4 required                              → 75
Experience: 24/48 months                         → 50
Education: BACHELOR >= required BACHELOR         → 100
Project: 1/2 required technologies               → 50

Total = 0.50×75 + 0.25×50 + 0.10×100 + 0.15×50
      = 37.5 + 12.5 + 10 + 7.5
      = 67.5 → MEDIUM
```

### SC-V04 — HIGH without intermediate rounding

```text
Skill: 4/4 required                              → 100
Experience: 36/48 months                         → 75
Education: MASTER >= required BACHELOR           → 100
Project: 2/3 required technologies               → 200/3

Total = 0.50×100 + 0.25×75 + 0.10×100 + 0.15×(200/3)
      = 50 + 18.75 + 10 + 10
      = 88.75 → HIGH
```

The Project display value may be `66.67`, but the total uses exact `200/3` rather than `66.67`.

### SC-V05 — missing Project evidence

```text
candidate.data_availability.projects = UNAVAILABLE
job.requirements.project.status = REQUIRED

ProjectScore = missing
analysis_status = INCOMPLETE
total_score = omitted
recommendation = omitted
ranking = excluded
```

### SC-V06 — explicit NO_MINIMUM/NO_REQUIREMENT

```text
Skill: 1/2 required                              → 50
Experience status NO_MINIMUM                     → 100
Education status NO_MINIMUM                      → 100
Project status NO_REQUIREMENT                    → 100

Total = 0.50×50 + 0.25×100 + 0.10×100 + 0.15×100
      = 25 + 25 + 10 + 15
      = 75 → MEDIUM
```

### SC-V07 — unavailable Job requirement

```text
job.requirements.experience.status = UNAVAILABLE

ExperienceScore = missing
analysis_status = INCOMPLETE
total_score = omitted
recommendation = omitted
ranking = excluded
```

### SC-V08 — stale analysis

```text
Stored Candidate skills: [python, sql]
Stored input_fingerprint: F1

Current Candidate skills: [python, sql, docker]
Freshly computed fingerprint: F2

F2 != F1
→ stored analysis is stale
→ do not return as current or rank
→ re-analyze and persist with current _rev
```

## 15. Additional test matrix

| ID | Component | Case | Expected |
|---|---|---|---|
| SC-01 | Skill | Required set empty | INCOMPLETE; invalid Job configuration |
| SC-02 | Skill | Optional-only match | No score increase |
| SC-03 | Experience | 60/48 months | 100 cap |
| SC-04 | Experience | Missing Candidate months | INCOMPLETE; no total |
| SC-05 | Education | BSc vs MSc | 0 |
| SC-06 | Education | MSc vs BSc | 100 |
| SC-07 | Project | 2 of 3 technologies | exact 200/3; display 66.67 |
| SC-08 | Project | NONE_DECLARED vs REQUIRED | 0 |
| SC-09 | Project | UNAVAILABLE vs REQUIRED | INCOMPLETE; no total |
| SC-10 | Aggregate | Any component missing | No total/recommendation/ranking |
| SC-11 | Freshness | Display name changes | Fingerprint unchanged |
| SC-12 | Freshness | Alias/config version changes | Fingerprint mismatch |
| SC-13 | Safety | Ground-truth pair supplied | Ignored/rejected as score input |
| SC-14 | Ranking | Equal total and skill | Earlier applied time, then Application ID |

## 16. Rejected scoring alternatives

| Decision | Approved | Rejected | Reason |
|---|---|---|---|
| Optional skills | Ignore | Capped bonus | Keeps Skill Score as required coverage |
| Experience | EXP-A ratio | EXP-B bands | Avoids threshold cliffs |
| Education | EDU-B binary | EDU-A ordinal distance | Avoids arbitrary partial credit |
| Project | PROJ-A technology coverage | PROJ-B coverage/count | Avoids extra synthetic count and relevance threshold |
| Missing input | Persist INCOMPLETE | Reject creation or fabricate a value | Retains diagnostics without fake totals |
| Threshold comparison | Unrounded total | Rounded total | Prevents display rounding from changing category/rank |

No rejected alternative may be enabled under the MVP configuration.

## 17. Implementation lock

DATA-02B must implement exactly the approved formulas, canonical paths, missing-input behavior, fingerprint and ranking rules in this document. It must not infer Job requirements from seniority, score `UNAVAILABLE` as zero, use synthetic inputs without provenance, round intermediate values, use ground truth as a feature, or produce a total for `INCOMPLETE`.
