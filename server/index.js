const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables FIRST
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { testConnection, initializeSchema } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Comprehensive CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Clean request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : res.statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
      const resetColor = '\x1b[0m';
      console.log(
        `${req.method.padEnd(6)} ${req.originalUrl.padEnd(40)} ${statusColor}${res.statusCode}${resetColor} (${duration}ms)`
      );
    });
    next();
  });
}

// Health check route with database status
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({
      success: true,
      message: 'Productivity Tracker API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: dbConnected ? 'connected' : 'disconnected',
    });
  } catch (err) {
    res.json({
      success: true,
      message: 'Productivity Tracker API is running (database unknown)',
      timestamp: new Date().toISOString(),
      database: 'error',
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err.toString(),
    }),
  });
});

// Start server with database initialization
async function startServer() {
  const green = '\x1b[32m';
  const blue = '\x1b[34m';
  const cyan = '\x1b[36m';
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  
  console.log(`\n${cyan}${bold}╔══════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}${bold}║${reset}  ${bold}Productivity Tracker API${reset}                              ${cyan}${bold}║${reset}`);
  console.log(`${cyan}${bold}╚══════════════════════════════════════════════════════════╝${reset}\n`);

  const dbConnected = await testConnection();

  if (dbConnected) {
    await initializeSchema();
  }

  app.listen(PORT, () => {
    console.log(`${cyan}${bold}╔══════════════════════════════════════════════════════════╗${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${green}${bold}✓ Server Ready${reset}                                           ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╠══════════════════════════════════════════════════════════╣${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${bold}Environment:${reset} ${process.env.NODE_ENV || 'development'.padEnd(38)} ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${bold}Port:${reset}        ${PORT.toString().padEnd(38)} ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${bold}Database:${reset}    ${dbConnected ? `${green}✓ Connected${reset}` : `${yellow}✗ Failed${reset}`.padEnd(45)} ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${bold}Auth:${reset}        ${green}✓ Ready${reset}${' '.repeat(30)} ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}║${reset}  ${bold}Routes:${reset}      ${green}✓ Loaded${reset}${' '.repeat(30)} ${cyan}${bold}║${reset}`);
    console.log(`${cyan}${bold}╚══════════════════════════════════════════════════════════╝${reset}\n`);
  });
}

startServer().catch(err => {
  console.error('\x1b[31m[FATAL]\x1b[0m Server startup error:', err.message);
  process.exit(1);
});

module.exports = app;
