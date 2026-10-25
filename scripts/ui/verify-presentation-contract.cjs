const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto'), { createRequire } = require('node:module');
const requireFrontend = createRequire(path.resolve('frontend/package.json'));
const espree = requireFrontend('espree');
const mode = process.argv[2]; assert.ok(['before', 'after', 'extend'].includes(mode));
const output = path.resolve('docs/surface-polish-verification'); fs.mkdirSync(output, { recursive: true });
const files = ['pages/Jobs/JobApplicantsPage.jsx', 'pages/Dashboard/RecruiterDashboard.jsx', 'pages/RecruiterProfile.jsx', 'pages/Jobs/CreateJob.jsx', 'pages/Dashboard/JobSeekerDashboard.jsx', 'pages/Landing.jsx', 'features/jobs/components/JobForm.jsx', 'features/jobs/components/PublicJobCard.jsx', 'features/applications/components/ApplicationUI.jsx', 'features/applications/components/CandidateApplicationCard.jsx', 'components/AccountHeader.jsx', 'features/applications/dashboardStyles.js'];
files.push('pages/Profile.jsx', 'features/profile/ProfileSections.jsx');
function normalize(value) { if (Array.isArray(value)) return value.map(normalize); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['start', 'end', 'loc', 'range', 'raw'].includes(key)).map(([key, child]) => [key, normalize(child)])); return value; }
function contract(file) {
  const source = fs.readFileSync(path.join('frontend/src', file), 'utf8');
  const ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } });
  const selected = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && ((node.callee.type === 'Identifier' && /^use(State|Effect|Callback|Memo|ApiResource|BookmarkPage)$/.test(node.callee.name)) || (node.callee.type === 'MemberExpression' && ['api', 'jobApi', 'applicationApi', 'recruiterProfileApi'].includes(node.callee.object?.name)))) selected.push(normalize(node));
    if (node.type === 'JSXAttribute' && (/^on[A-Z]/.test(node.name?.name || '') || ['id', 'name', 'type', 'disabled', 'required', 'readOnly', 'maxLength', 'min', 'max', 'value', 'checked', 'href', 'to', 'path', 'aria-label', 'aria-expanded', 'aria-selected'].includes(node.name?.name))) selected.push(normalize(node));
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child?.type) visit(child);
  }
  visit(ast);
  return { count: selected.length, hash: createHash('sha256').update(JSON.stringify(selected)).digest('hex') };
}
const result = Object.fromEntries(files.map(file => [file, contract(file)]));
if (mode === 'extend') {
  const previous = JSON.parse(fs.readFileSync(path.join(output, 'source-contract-before.json')));
  for (const [file, state] of Object.entries(previous)) assert.deepEqual(result[file], state);
  fs.writeFileSync(path.join(output, 'source-contract-before.json'), JSON.stringify({ ...result, ...previous }, null, 2));
  console.log('Extended baseline with candidate profile before presentation edits');
  process.exit(0);
}
if (mode === 'after') assert.deepEqual(result, JSON.parse(fs.readFileSync(path.join(output, 'source-contract-before.json'))), 'Business hooks, handlers or field/API attributes changed');
fs.writeFileSync(path.join(output, `source-contract-${mode}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ mode, files: files.length, business_hooks_handlers_fields_api_unchanged: mode === 'after' }, null, 2));
