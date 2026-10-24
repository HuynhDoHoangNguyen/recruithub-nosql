import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RecruiterRegistrationFields from '../../src/components/auth/RecruiterRegistrationFields';
import {
  companyNameComparisonKey,
  departmentKeyFromName,
  normalizeCompanyName,
  recruiterRegistrationInput,
  validateRecruiterRegistration,
} from '../../src/utils/recruiterRegistration';

const validForm = {
  email: 'recruiter@example.com',
  password: 'StrongPass1',
  confirm_password: 'StrongPass1',
  company_name: '  Công   ty Ánh Dương ',
  industry: ' Công nghệ ',
  website: '',
  address: '',
  department_name: ' Nhân sự ' ,
};

describe('Recruiter registration fields and validation', () => {
  it('renders only schema-supported inputs without role or document ID fields', () => {
    render(<RecruiterRegistrationFields value={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Tên công ty mới')).toBeTruthy();
    expect(screen.getByLabelText('Phòng ban')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByLabelText(/họ và tên/i)).toBeNull();
    expect(screen.queryByLabelText(/role|vai trò|document id|_id/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /đăng ký/i })).toBeNull();
  });

  it('normalizes names without inventing IDs or mutating optional fields', () => {
    expect(normalizeCompanyName(validForm.company_name)).toBe('Công ty Ánh Dương');
    expect(companyNameComparisonKey(validForm.company_name)).toBe(companyNameComparisonKey('CÔNG TY ÁNH DƯƠNG'));
    expect(departmentKeyFromName(validForm.department_name)).toBe('nhan-su');
    expect(recruiterRegistrationInput(validForm)).toEqual({
      email: 'recruiter@example.com',
      password: 'StrongPass1',
      company: { name: 'Công ty Ánh Dương', industry: 'Công nghệ' },
      department: { name: 'Nhân sự' },
    });
    expect(recruiterRegistrationInput(validForm)).not.toHaveProperty('role');
    expect(recruiterRegistrationInput(validForm)).not.toHaveProperty('company._id');
  });

  it.each([
    [{ ...validForm, email: 'bad' }, 'email'],
    [{ ...validForm, password: 'weak' }, 'Mật khẩu'],
    [{ ...validForm, confirm_password: 'Different1' }, 'không khớp'],
    [{ ...validForm, company_name: '  ' }, 'tên công ty'],
    [{ ...validForm, industry: '' }, 'lĩnh vực'],
    [{ ...validForm, department_name: '---' }, 'phòng ban'],
    [{ ...validForm, website: 'javascript:alert(1)' }, 'Website'],
  ])('rejects invalid form data', (form, expectedMessage) => {
    expect(validateRecruiterRegistration(form)).toContain(expectedMessage);
  });

  it('accepts valid required fields and optional HTTP company details', () => {
    expect(validateRecruiterRegistration(validForm)).toBe('');
    expect(validateRecruiterRegistration({ ...validForm, website: 'https://company.example' })).toBe('');
  });

  it('does not send data anywhere when a preview field changes', () => {
    const onChange = vi.fn();
    render(<RecruiterRegistrationFields value={{ company_name: '' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Tên công ty mới'), { target: { value: 'New Company' } });
    expect(onChange).toHaveBeenCalledWith({ company_name: 'New Company' });
  });
});
