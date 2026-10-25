import { describe, expect, it } from 'vitest';
import { dashboardPathForRole, postLoginPath } from '../../src/utils/authNavigation';

describe('role-aware post-login navigation', () => {
  it.each([
    ['CANDIDATE', '/user/dashboard'],
    ['RECRUITER', '/recruiter/dashboard'],
    ['ADMIN', '/admin/dashboard'],
  ])('uses the actual %s dashboard route', (role, expected) => {
    expect(dashboardPathForRole(role)).toBe(expected);
    expect(postLoginPath(role)).toBe(expected);
  });

  it('keeps a same-role protected destination including query and hash', () => {
    expect(postLoginPath('RECRUITER', '/recruiter/jobs/job%3A1/applicants?tab=all#list'))
      .toBe('/recruiter/jobs/job%3A1/applicants?tab=all#list');
  });
  it('returns the Recruiter to the separate company profile after signing in', () => {
    expect(postLoginPath('RECRUITER', '/recruiter/profile')).toBe('/recruiter/profile');
    expect(postLoginPath('CANDIDATE', '/recruiter/profile')).toBe('/user/dashboard');
  });

  it('returns a candidate to a valid public Job detail after login', () => {
    expect(postLoginPath('CANDIDATE', '/jobs/job%3Acms%3AJ_000001?apply=1'))
      .toBe('/jobs/job%3Acms%3AJ_000001?apply=1');
  });

  it.each([
    ['CANDIDATE', '/admin/dashboard'],
    ['RECRUITER', '/profile'],
    ['ADMIN', '/recruiter/dashboard'],
    ['ADMIN', '//evil.invalid/path'],
    ['CANDIDATE', 'https://evil.invalid/path'],
    ['CANDIDATE', '/\\evil.invalid/path'],
    ['CANDIDATE', '/jobs/not-a-job-id'],
  ])('rejects forbidden or external destination %s %s', (role, destination) => {
    expect(postLoginPath(role, destination)).toBe(dashboardPathForRole(role));
  });
});
