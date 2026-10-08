import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));

app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to RecruiHub API'
  });
});

export default app;
