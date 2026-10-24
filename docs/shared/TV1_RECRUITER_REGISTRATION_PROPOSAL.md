# TV1 Recruiter Self-Registration Proposal — Pending Approval

**Status:** TV1 product direction proposed; Auth/group approval and TV2 ownership acknowledgement are pending. This document does not activate an endpoint or authorize CouchDB writes.

## Proposed product rules

- Public registration continues to support Candidate and proposes adding Recruiter.
- A Recruiter registrant must declare a new Company and a Department under that Company. They cannot select or claim an existing Company.
- No Recruiter full name is stored: the User, Recruiter, Company and Department schemas do not define that field.
- No public Admin signup, company verification, approval workflow, onboarding document or extra account status is proposed for this MVP.
- A Recruiter may use protected features only after the server verifies an ACTIVE RECRUITER User and a complete, internally consistent Recruiter → Company/Department relationship.
- A self-declared Company is not a verified business.

## Schema and identifier fit

The existing strict schemas support the required document types and relationships without adding fields:

| Document | Required registration data | Existing helper/constraint |
|---|---|---|
| User | normalized email, password hash, role `RECRUITER`, status `ACTIVE`, timestamps | `userIdFromEmail(email_normalized)`; no `full_name` field |
| Company | name, industry, timestamps, provenance | Gated signup currently uses `company:user:<sha256(normalized_name)>`; convention remains pending team approval. |
| Department | company reference, display name, lowercase slug key, timestamps, provenance | Gated signup currently uses `department:user:<sha256(company_id + newline + department_key)>`; convention remains pending team approval. |
| Recruiter | User, Company and Department references, timestamps, provenance | Gated signup currently uses `recruiter:user:<sha256(user_id + newline + company_id + newline + department_id)>`; no full name/company ownership field. |

Self-registration provenance currently written by the gated implementation is `mixed`: Company name/industry and optional website/address plus Department name use `recruiter_self_registration`; Department key uses `normalized`; Company/Department references on Recruiter and Department use `derived`. User provenance remains omitted because the User schema allows it to be absent and credentials/role/status are server-managed. Confirm this field-origin vocabulary with the data owner before enabling the route.

Company duplicate detection needs an agreed canonicalization policy (Unicode normalization, case, whitespace, punctuation and industry). CouchDB has no unique constraint over Company names. A deterministic ID can prevent duplicate creation only when every caller uses the same approved natural key; that key is not currently defined for user-submitted Companies.

The gated implementation uses a distinct `*:user:*` namespace rather than the synthetic generator helpers. The schema accepts these IDs, but shape compatibility is not semantic approval. The product/data owners still need to approve the public-registration ID namespace/key and provenance mapping before activation.

## Coordinator proposal and recovery blocker

CouchDB does not provide an atomic transaction across the four documents. The coordinator must not issue a JWT or authorize protected Recruiter operations until all four documents validate and references agree. It must never use `LOCKED` or `RESET_REQUIRED` as an in-progress state.

The proposed successful order, subject to contract approval, is:

1. Validate/normalize input and derive User, Company, Department and Recruiter IDs server-side.
2. Check canonical email and Company duplicate policy.
3. Create the User as the first idempotency anchor, then Company, Department and Recruiter with conditional create/expected absence; validate every document and cross-reference. (Exact CouchDB conditional-create support must be confirmed for the client.)
4. Do not return a token from registration until all writes and relationship checks succeed. Login and every authenticated request must also resolve and validate the complete Recruiter→Department→Company graph; otherwise an ACTIVE User could obtain a session during the partial-write window.

This flow has a **gated TV1 implementation**, but remains a proposed product/contract change. If a write fails partway, retry and a competing signup can observe the same Company/Department documents. Existing schemas contain no registration-attempt ID or Company creator identity, so the service cannot prove that a partial Company belongs to the retrying account. The implementation therefore never resumes or reuses partial records: it stops at the first failure, returns a traceable non-secret reference, and requires operator reconciliation. A deterministic ID alone does not establish ownership or transactionality.

Minimum choices for the owners to resolve:

1. **Smallest schema change:** add a durable idempotency/registration-attempt marker with an ownership rule to an approved existing document (or introduce an onboarding document, contrary to the requested no-new-document direction), then define conditional create/recovery and conflict behavior; or
2. **No schema change:** make partial attempts operator-reconciled and never auto-resume/reuse Company/Department records. This avoids unsafe attachment but does not meet automatic safe-retry/recovery expectations and may leave orphan documents.

Do not silently add fields, a document type, index, status, transaction assumption, retry loop, or duplicate merge. Revision retries remain unresolved under DR-004 (`AGENTS.md` vs DATA-02A); do not add automatic mutation retries until reconciled.

## TV2 Job ownership integration proposal

The existing Job schema requires `recruiter_id`, `company_id`, and `department_id`. The TV2 Job service derives all three from the authenticated Recruiter document when creating a Job; request schemas reject those references in client payloads. Job detail, edit, status changes, applicant listing, and Application detail/stage operations resolve the Recruiter scope and require the Job's three references to match it. Auth checks that the User is `ACTIVE` with role `RECRUITER` and that exactly one Recruiter document resolves to an existing Company and Department whose `company_id` matches. No Admin override is added: current Job routes require `RECRUITER`, and Admin receives 403.

These source-level behaviors align with BR-04…BR-09 as an integration proposal. They do **not** record TV2 approval. TV2 must acknowledge the scope semantics and whether Admin access should remain excluded before public Recruiter signup is activated.

## Activation gates

- Product owner and Auth/security approve DR-003/DR-019 wording and recovery behavior.
- TV2 confirms recruiter scope: ACTIVE User with role RECRUITER, complete valid Recruiter/Company/Department references, Job operations limited to the permitted ownership scope, and no Admin override unless separately approved.
- Agree Company duplicate normalization and deterministic ID convention.
- Agree duplicate email/company responses, concurrency behavior, partial-write recovery and operator repair procedure.
- Add API contract, negative authorization tests and isolated-database write E2E plan. Until then, keep the current Candidate-only API and Register page unchanged.

## Implementation status

Recruiter fields, validation, ID derivation, registration route and organization checks are implemented behind disabled-by-default backend/frontend flags. Candidate registration endpoint/payload remains unchanged. Keep the flags false until Auth/product approval, TV2 scope acknowledgement and the operator recovery procedure are recorded. The implementation uses no new schema fields/document types and does not create indexes.

The write order is Company → Department → Recruiter → ACTIVE User, with all documents schema-validated before the first write. This leaves no active User until the three organization documents exist. On a write error, processing stops; no automatic retry or delete is attempted. The response includes a non-secret registration reference and deterministic IDs that may have been created. An operator must inspect references and reconcile before another attempt.

Operator recovery for `REGISTRATION_INCOMPLETE`: use the returned `registration_ref` and document ID list; read the listed documents and verify type, schema, timestamps and cross-references without displaying password hashes. Check whether a User exists, whether a Recruiter or Job already references the organization documents, and whether the IDs belong to this failed request. Do not repeat the registration or delete anything automatically. If the User is absent and the organization documents are unreferenced orphans, an authorized operator may remove only those exact documents in reverse dependency order after confirming no Jobs/Applications or other documents reference them; otherwise stop and escalate for manual repair. If the User exists and all four documents form a valid graph, the user can attempt normal login; Auth validates the graph before issuing a token. Record the outcome in the project’s approved operational log without credentials or hashes.

Public Company IDs use `company:user:<sha256(normalized_name)>`; Department IDs use `department:user:<sha256(company_id + newline + department_key)>`; Recruiter IDs use `recruiter:user:<sha256(user_id + newline + company_id + newline + department_id)>`. These prefixes are accepted by the current schema regex but remain a project contract decision. They are distinct from existing `*:syn:*` synthetic generator IDs. Company duplicate comparison is NFKC + whitespace collapse + Vietnamese case-fold; matching is a rejection signal only and never grants ownership. The check scans Company documents and is intended for MVP scale, not high-volume production.
