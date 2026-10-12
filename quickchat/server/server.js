require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const registerChatHandlers = require('./sockets/chat.socket');
const realtime = require('./realtime');
const { isUsingDevSecret } = require('./utils/token');

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const IS_PROD = process.env.NODE_ENV === 'production';

function parseOrigins(value) {
  const origins = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) {
    return true;
  }

  return origins;
}

const corsOrigin = parseOrigins(CLIENT_ORIGIN);

if (IS_PROD && isUsingDevSecret()) {
  console.error('[server] JWT_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}

if (IS_PROD && corsOrigin === true) {
  console.warn('[server] CLIENT_ORIGIN is "*" in production. Restrict it to your clients.');
}

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ message: 'QuickChat API is running' });
});

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

realtime.setIo(io);
registerChatHandlers(io);

const start = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
};

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] ${signal} received, shutting down`);

  io.close();

  server.close(async () => {
    try {
      await mongoose.connection.close();
    } catch (err) {
      console.error('[server] error closing MongoDB connection', err.message);
    }

    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();

module.exports = { app, server, io };
