import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import { JobApplicationRepository } from './repositories/job-application.repository.js';
import { JobService } from './services/job.service.js';
import { ApplicationService } from './services/application.service.js';
import { ApiError, createJwtAuthentication, jobApplicationErrorHandler } from './middleware/job-application.middleware.js';
import { createJobRoutes } from './routes/job.routes.js';
import { createApplicationRoutes } from './routes/application.routes.js';
import databaseHealthRoutes from './routes/database-health.routes.js';
import apiV1Routes from './routes/api-v1.routes.js';
import { getAuthDatabaseConfig } from './config/auth-database.config.js';
import { ResumeScoringService } from './services/scoring/resume-scoring.service.js';
import { createScoringRoutes } from './routes/scoring.routes.js';

function configuredFrontendOrigins(value = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const origins = value.split(',').map(item => item.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try {
      const parsed = new URL(origin);
      return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || origin === '*';
    } catch { return true; }
  })) throw new Error('FRONTEND_URL must contain exact http(s) origins separated by commas.');
  return origins;
}

function createConfiguredRepository(environment) {
  let repository;
  const getRepository = () => {
    if (!repository) {
      const config = getAuthDatabaseConfig(environment);
      const authHeader = config.username && config.password
        ? `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
        : undefined;
      repository = new JobApplicationRepository({ ...config, authHeader });
    }
    return repository;
  };
  return Object.fromEntries(['get', 'put', 'find', 'scanPublicJobs', 'profile', 'allInterviews', 'view', 'stats', 'initialize']
    .map(method => [method, (...args) => getRepository()[method](...args)]));
}

export function createApp({ repository: suppliedRepository, authenticate, now, analyzeApplication, jwtEnv = process.env } = {}) {
  const app = express();
  const origins = configuredFrontendOrigins(jwtEnv.FRONTEND_URL);
  const repository = suppliedRepository || createConfiguredRepository(jwtEnv);
  const scoringClock = typeof now === 'function' ? now : () => (now ? new Date(now()) : new Date());
  const scoringService = new ResumeScoringService(repository, { now: scoringClock });
  const effectiveAnalyzeApplication = analyzeApplication || scoringService.analyzeApplication;

  const dependencies = {
    authenticate: authenticate || createJwtAuthentication(repository, jwtEnv, () => now ? new Date(now()).getTime() : Date.now()),
    jobs: new JobService(repository, now),
    applications: new ApplicationService(repository, {
      now,
      analyzeApplication: effectiveAnalyzeApplication,
      scoringService,
      getAnalysisSummary: scoringService.getAnalysisSummary,
    }),
    scoring: scoringService,
  };

  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'If-Match'],
    exposedHeaders: ['ETag'],
  }));
  app.use(express.json({ limit: '512kb' }));
  app.use('/api/health', healthRoutes);
  app.use('/api/health/database', databaseHealthRoutes);

  // Identity routes and Job/Application routes share one v1 namespace and auth contract.
  app.use('/api/v1', apiV1Routes);
  app.use('/api/v1', createJobRoutes(dependencies));
  app.use('/api/v1/applications', createApplicationRoutes(dependencies));
  app.use('/api/v1/resume-analysis', createScoringRoutes(dependencies));
  app.get('/', (req, res) => res.json({ message: 'Welcome to RecruiHub API' }));
  app.use('/api/v1', (req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API.')));
  app.use(jobApplicationErrorHandler);
  return app;
}

export default createApp();
