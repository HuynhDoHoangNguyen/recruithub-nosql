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

  it.each([
    ['CANDIDATE', '/admin/dashboard'],
    ['RECRUITER', '/profile'],
    ['ADMIN', '/recruiter/dashboard'],
    ['ADMIN', '//evil.invalid/path'],
    ['CANDIDATE', 'https://evil.invalid/path'],
    ['CANDIDATE', '/\\evil.invalid/path'],
  ])('rejects forbidden or external destination %s %s', (role, destination) => {
    expect(postLoginPath(role, destination)).toBe(dashboardPathForRole(role));
  });
});
