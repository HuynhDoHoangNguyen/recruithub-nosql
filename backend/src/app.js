import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import databaseHealthRoutes from './routes/database-health.routes.js';
import apiV1Routes from './routes/api-v1.routes.js';

const app = express();

function configuredFrontendOrigins(value = process.env.FRONTEND_URL || 'http://localhost:5173') {
  const origins = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || origin === '*';
    } catch { return true; }
  })) {
    throw new Error('FRONTEND_URL must contain exact http(s) origins separated by commas.');
  }
  return origins;
}

const frontendOrigins = configuredFrontendOrigins();

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || frontendOrigins.includes(origin)),
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'If-Match'],
  exposedHeaders: ['ETag'],
}));

app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/health/database', databaseHealthRoutes);
app.use('/api/v1', apiV1Routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to RecruiHub API'
  });
});

export default app;
