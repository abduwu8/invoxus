require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieSession = require('cookie-session');
const path = require('path');
const { connectToDatabase } = require('./config/db');

const authRoutes = require('./routes/auth');
const gmailRoutes = require('./routes/gmail');
const scheduleRoutes = require('./routes/schedule');
const inngestHandler = require('./inngest/handler');
const chatRoutes = require('./routes/chat');
const coldEmailRoutes = require('./routes/coldEmail');
const paymentRoutes = require('./routes/payment');

const app = express();
// When behind a proxy (e.g., Render), enable trust so secure cookies work
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
// Allow setting deployed URL(s) at runtime
if (process.env.SERVER_PUBLIC_URL) allowedOrigins.add(process.env.SERVER_PUBLIC_URL);
if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.add(process.env.RENDER_EXTERNAL_URL);

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? true // reflect request origin; avoids false negatives on custom domains
    : function (origin, callback) {
        if (!origin) return callback(null, true);
        if (process.env.CORS_ALLOW_ALL === '1') return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use(
  cookieSession({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60, // 1h
  })
);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Root (only in development). In production, SPA fallback serves index.html
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.send('Email backend is running.');
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/inngest', inngestHandler);
app.use('/api/chat', chatRoutes);
app.use('/api/cold-email', coldEmailRoutes);
app.use('/api/payment', paymentRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  // SPA fallback after API routes using a regex (compatible with Express v5)
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || '';

async function start() {
  try {
    await connectToDatabase(MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();