const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const openApiSpec = require('./docs/openapi');
const { ensureAdminAccount } = require('./services/auth/auth.service');
const authRoutes = require('./routes/auth.routes');
const customerManagementRoutes = require('./routes/customers/management.routes');
const customerPortalRoutes = require('./routes/customers/portal.routes');
const bookingRoutes = require('./routes/bookings/booking.routes');
const fleetRoutes = require('./routes/fleet/fleet.routes');
const driverRoutes = require('./routes/drivers/driver.routes');
const tripRoutes = require('./routes/trips/trip.routes');

const app = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

// Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin))
}));

// Health Check Route
app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.get('/api/docs.json', (_request, response) => response.json(openApiSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  explorer: true,
  swaggerOptions: { persistAuthorization: true, tryItOutEnabled: true }
}));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers/management', customerManagementRoutes);
app.use('/api/v1/customers/portal', customerPortalRoutes);
app.use('/api/v1/customers/booking', bookingRoutes);
app.use('/api/v1/fleet/vehicles', fleetRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/trips', tripRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}. Please check the endpoint URL.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) console.error(err.stack);
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Internal Server Error' : err.message
  });
});

async function startServer(options = {}) {
  const mongoUri = options.mongoUri || process.env.MONGODB_URI;
  const port = options.port ?? Number(process.env.PORT || 5000);

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Copy server/.env.example to server/.env and configure it.');
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  await ensureAdminAccount();

  const server = app.listen(port);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  console.log(`API server listening on http://localhost:${typeof address === 'object' ? address.port : port}`);
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start API server:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };