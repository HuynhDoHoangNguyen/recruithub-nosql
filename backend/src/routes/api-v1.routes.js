import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import { createCandidateProfileRouter } from './candidate-profile.routes.js';
import { createAdminUserRouter } from './admin-user.routes.js';
import { createOrganizationLookupRouter } from './organization-lookup.routes.js';

// Shared versioned namespace. Domain routers remain owned by their respective teams.
const apiV1Routes = Router();
apiV1Routes.use('/auth', createAuthRouter());
apiV1Routes.use('/candidate/profile', createCandidateProfileRouter());
apiV1Routes.use('/admin', createAdminUserRouter());
apiV1Routes.use('/companies', createOrganizationLookupRouter());

export default apiV1Routes;
