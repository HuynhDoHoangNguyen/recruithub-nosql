// Stable option keys shared by forms and public search through /jobs/metadata.
export const JOB_LOCATIONS = [
  { value: 'VN-HN', label: 'Hà Nội' },
  { value: 'VN-SG', label: 'TP. Hồ Chí Minh' },
  { value: 'VN-DN', label: 'Đà Nẵng' },
  { value: 'VN-CT', label: 'Cần Thơ' },
  { value: 'VN-HP', label: 'Hải Phòng' },
  { value: 'VN-OTHER', label: 'Tỉnh / thành khác tại Việt Nam' },
  { value: 'INTERNATIONAL', label: 'Ngoài Việt Nam' },
];
export const WORK_MODES = [
  { value: 'HYBRID', label: 'Hybrid (Linh hoạt)' },
  { value: 'REMOTE', label: 'Remote (Từ xa)' },
  { value: 'ONSITE', label: 'Onsite (Tại văn phòng)' },
];
export const SENIORITIES = [
  { value: 'INTERN', label: 'Intern' },
  { value: 'FRESHER', label: 'Fresher' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MID', label: 'Có kinh nghiệm / Mid-level' },
  { value: 'SENIOR', label: 'Senior' },
];
export const JOB_SENIORITY_VALUES = SENIORITIES.map(option => option.value);
export const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full time' },
  { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Hợp đồng' },
  { value: 'INTERNSHIP', label: 'Intern (Thực tập)' },
];
