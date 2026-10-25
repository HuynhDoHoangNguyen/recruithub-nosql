export const PROFILE_FIELDS = ['full_name', 'role', 'industry', 'seniority', 'years_experience', 'summary', 'phone', 'location'];
export const COLLECTION_FIELDS = ['skills', 'education', 'experience', 'projects', 'languages'];

const equalJson = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function comparableDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? null : Number(match[3]);
  if (month < 1 || month > 12 || (day !== null && (day < 1 || day > 31))) return null;
  if (match[3] !== undefined) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  }
  return { month: year * 12 + month, day };
}

export function hasInvalidDateRange(items, baselineItems = []) {
  return items.some((item, index) => {
    const baseline = baselineItems[index];
    const datesChanged = !baseline
      || item.start_date !== baseline.start_date
      || item.end_date !== baseline.end_date;
    if (!datesChanged) return false;
    const startValue = item.start_date?.trim();
    const endValue = item.end_date?.trim();
    const start = startValue ? comparableDate(startValue) : null;
    const end = endValue ? comparableDate(endValue) : null;
    if ((startValue && start === null) || (endValue && end === null)) return true;
    if (!startValue || !endValue) return false;
    if (end.month !== start.month) return end.month < start.month;
    return start.day !== null && end.day !== null && end.day < start.day;
  });
}

export function candidateProfilePatch(profile, baseline) {
  const patch = {
    profile: Object.fromEntries(PROFILE_FIELDS
      .filter((key) => profile.profile?.[key] !== undefined && (key !== 'summary' || (typeof profile.profile[key] === 'string' && profile.profile[key].trim() !== '')))
      .map((key) => [key, profile.profile[key]])),
  };
  for (const field of COLLECTION_FIELDS) {
    if (!equalJson(profile[field] || [], baseline[field] || [])) patch[field] = profile[field] || [];
  }
  let filesChanged = false;
  for (const [field, input] of [['resume_file', 'resume_file_id'], ['avatar', 'avatar_asset_id']]) {
    if ((profile[field]?.asset_id || null) !== (baseline[field]?.asset_id || null)) { patch[input] = profile[field]?.asset_id || null; filesChanged = true; }
  }
  if (filesChanged && Object.keys(patch.profile).every(key => equalJson(profile.profile[key], baseline.profile[key])) && !COLLECTION_FIELDS.some(key => key in patch)) delete patch.profile;
  return patch;
}

export function profileCollectionChanged(profile, baseline, field) {
  return !equalJson(profile[field] || [], baseline[field] || []);
}

export function updatedProfileItem(item, key, value) {
  const next = { ...item };
  if (key === 'name' && 'normalized' in item) next.normalized = value.normalize('NFKC').trim().toLowerCase();
  if (value === '' && key !== 'name' && key !== 'degree' && key !== 'technologies') delete next[key];
  else next[key] = value;
  return next;
}
