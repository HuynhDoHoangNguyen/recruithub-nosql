// Development-only fixtures. They are not production data and do not represent the CouchDB dataset.
export const publicJobFixtures = [
  {
    id: 'job:demo:frontend-engineer', status: 'OPEN', title: 'Frontend Engineer', company: { name: 'Northstar Labs', industry: 'Technology' },
    seniority: 'MID', industry: 'Technology', description: 'Build accessible candidate experiences with a small product team.',
    responsibilities: ['Build React interfaces', 'Work with design and API teams'], requiredSkills: ['React', 'JavaScript', 'CSS'], optionalSkills: ['Testing'],
    deadline: '2027-03-31T23:59:00Z', createdAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'job:demo:backend-engineer', status: 'OPEN', title: 'Backend Engineer', company: { name: 'Riverbank Systems', industry: 'Finance' },
    seniority: 'JUNIOR', industry: 'Finance', description: 'Develop reliable Node.js APIs and data integrations.',
    responsibilities: ['Implement REST APIs', 'Maintain service quality'], requiredSkills: ['Node.js', 'Express', 'CouchDB'], optionalSkills: ['Docker'],
    deadline: '2027-02-28T23:59:00Z', createdAt: '2026-10-18T10:00:00Z',
  },
  {
    id: 'job:demo:data-analyst', status: 'OPEN', title: 'Data Analyst', company: { name: 'Greenfield Health', industry: 'Healthcare' },
    seniority: 'MID', industry: 'Healthcare', description: 'Turn operational data into clear, useful product insights.',
    responsibilities: ['Explore datasets', 'Communicate findings'], requiredSkills: ['SQL', 'Python'], optionalSkills: ['Power BI'],
    deadline: '2027-01-31T23:59:00Z', createdAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 'job:demo:product-designer', status: 'OPEN', title: 'Product Designer', company: { name: 'Northstar Labs', industry: 'Technology' },
    seniority: 'SENIOR', industry: 'Technology', description: 'Shape clear, responsive experiences for job seekers and recruiters.',
    responsibilities: ['Prototype workflows', 'Maintain design system'], requiredSkills: ['Figma', 'UX Research'], optionalSkills: ['React'],
    deadline: '2027-04-15T23:59:00Z', createdAt: '2026-10-12T10:00:00Z',
  },
];
