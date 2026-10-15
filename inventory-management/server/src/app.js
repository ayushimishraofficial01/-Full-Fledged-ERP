const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const sanitize = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', /^\d+$/.test(env.trustProxy) ? Number(env.trustProxy) : env.trustProxy);

  // Google Sign-In loads a script/iframe from accounts.google.com, so allow it only when it is configured.
  const googleHelmet = env.googleClientId
    ? {
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
            'frame-src': ["'self'", 'https://accounts.google.com/gsi/'],
            'connect-src': ["'self'", 'https://accounts.google.com/gsi/'],
          },
        },
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      }
    : {};
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, ...googleHelmet }));
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server (no Origin header) and configured client URLs.
        if (!origin || env.clientUrl.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );
  app.use(compression());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitize);

  // Product images. Filenames are random; directory listing is off.
  app.use('/uploads', express.static(env.uploadDir, { index: false, dotfiles: 'deny', maxAge: '7d', fallthrough: false }));

  app.use('/api', apiLimiter, require('./routes'));
  app.use('/api', notFound);

  // Optional: serve the built React app from the same origin in production.
  if (env.serveClient && fs.existsSync(env.clientDist)) {
    app.use(express.static(env.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(path.join(env.clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
