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

export function createApp({ repository = new JobApplicationRepository(), authenticate, now, analyzeApplication, jwtEnv } = {}) {
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));

app.use(express.json({ limit: '512kb' }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/health/database', databaseHealthRoutes);
const dependencies = { authenticate: authenticate || createJwtAuthentication(repository, jwtEnv),
  jobs: new JobService(repository, now), applications: new ApplicationService(repository, { now, analyzeApplication }) };
app.use('/api/v1', createJobRoutes(dependencies));
app.use('/api/v1/applications', createApplicationRoutes(dependencies));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to RecruiHub API'
  });
});
app.use('/api/v1', (req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API.')));
app.use(jobApplicationErrorHandler);
return app;
}

export default createApp();
