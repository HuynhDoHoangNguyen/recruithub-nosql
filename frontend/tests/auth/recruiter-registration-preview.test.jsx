import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecruiterRegistrationFields from '../../src/components/auth/RecruiterRegistrationFields';
import { recruiterRegistrationInput, validateRecruiterRegistration } from '../../src/utils/recruiterRegistration';

const organizationApi = vi.hoisted(() => ({ searchCompanies: vi.fn(), getCompanyDepartments: vi.fn() }));
vi.mock('../../src/services/organizationApi', () => organizationApi);

const company = { id: 'company:acme', name: 'Acme Technology', industry: 'Technology' };
const departments = [
  { id: 'department:engineering', name: 'Engineering' },
  { id: 'department:people', name: 'People Operations' },
];

const ControlledRecruiterFields = ({ onChange }) => {
  const [value, setValue] = useState({ email: 'recruiter@example.com', password: 'StrongPass1' });
  return <RecruiterRegistrationFields value={value} onChange={(nextValue) => { setValue(nextValue); onChange(nextValue); }} />;
};

describe('Recruiter registration fields and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationApi.searchCompanies.mockResolvedValue([company]);
    organizationApi.getCompanyDepartments.mockResolvedValue(departments);
  });

  it('shows account credentials and requires selecting an existing Company and Department', () => {
    render(<RecruiterRegistrationFields value={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Tìm công ty')).toBeTruthy();
    expect(screen.getByLabelText('Phòng ban').disabled).toBe(true);
    expect(screen.queryByLabelText(/họ và tên|lĩnh vực hoạt động|website|địa chỉ|tên công ty mới/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /đăng ký/i })).toBeNull();
  });

  it('validates credential and selected document IDs only', () => {
    const validForm = {
      email: 'recruiter@example.com', password: 'StrongPass1', confirm_password: 'StrongPass1',
      company_id: company.id, department_id: departments[0].id,
    };
    expect(recruiterRegistrationInput(validForm)).toEqual({
      email: 'recruiter@example.com', password: 'StrongPass1', company_id: company.id, department_id: departments[0].id,
    });
    expect(recruiterRegistrationInput(validForm)).not.toHaveProperty('role');
    expect(recruiterRegistrationInput(validForm)).not.toHaveProperty('confirm_password');
    expect(recruiterRegistrationInput(validForm)).not.toHaveProperty('company');
    expect(validateRecruiterRegistration(validForm)).toBe('');
    expect(validateRecruiterRegistration({ ...validForm, company_id: '' })).toContain('chọn công ty');
    expect(validateRecruiterRegistration({ ...validForm, department_id: '' })).toContain('chọn phòng ban');
    expect(validateRecruiterRegistration({ ...validForm, password: 'weak' })).toContain('Mật khẩu');
  });

  it('searches with keyboard, selects a Company, loads its Departments, and emits selected IDs', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledRecruiterFields onChange={onChange} />);
    const companyInput = screen.getByLabelText('Tìm công ty');
    await user.type(companyInput, 'Acme');
    const suggestion = await screen.findByRole('option', { name: /Acme Technology.*Technology/i });
    expect(organizationApi.searchCompanies).toHaveBeenCalledWith('Acme', expect.any(AbortSignal));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByText('Đã chọn: Acme Technology')).toBeTruthy();
    await waitFor(() => expect(organizationApi.getCompanyDepartments).toHaveBeenCalledWith(company.id, expect.any(AbortSignal)));
    const departmentSelect = screen.getByLabelText('Phòng ban');
    await waitFor(() => expect(departmentSelect.disabled).toBe(false));
    await user.selectOptions(departmentSelect, departments[0].id);
    expect(onChange).toHaveBeenLastCalledWith({
      email: 'recruiter@example.com', password: 'StrongPass1', company_id: company.id, department_id: departments[0].id,
    });
    expect(suggestion).toBeTruthy();
  });

  it('clears the selected organization relationship when the Company query changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecruiterRegistrationFields value={{ company_id: company.id, department_id: departments[0].id }} onChange={onChange} />);
    await user.type(screen.getByLabelText('Tìm công ty'), 'New');
    expect(onChange).toHaveBeenLastCalledWith({ company_id: '', department_id: '' });
    expect(screen.getByLabelText('Phòng ban').disabled).toBe(true);
  });

  it('shows the unsupported Company message when search returns no matches', async () => {
    organizationApi.searchCompanies.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<RecruiterRegistrationFields value={{}} onChange={vi.fn()} />);
    await user.type(screen.getByLabelText('Tìm công ty'), 'Unknown');
    expect(await screen.findByText(/Hiện chưa hỗ trợ công ty này/i)).toBeTruthy();
  });

  it('supports password visibility controls', async () => {
    const user = userEvent.setup();
    render(<RecruiterRegistrationFields value={{ password: 'StrongPass1' }} onChange={vi.fn()} />);
    const password = screen.getByLabelText('Mật khẩu', { selector: '#recruiter-password' });
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(password.type).toBe('text');
  });
});
