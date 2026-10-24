const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// ✅ FIX 1: Trust proxy required for Render deployment (Fixes rate-limit crash)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// 1. Security headers with Helmet
app.use(helmet({ contentSecurityPolicy: false }));

// 2. Rate Limiting: Prevent Brute-Force Attacks on Auth & Checkout
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// Apply rate limiters to sensitive routes
app.use('/auth/', globalLimiter);
app.use('/student/checkout/', globalLimiter);

// Parse incoming form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (CSS, JS, images) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure MySQL Session Store so logins persist across server restarts
const sessionStoreOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 mins
    expiration: 86400000 // 1 day
};

const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(session({
    key: 'robera_tech_session',
    secret: process.env.SESSION_SECRET || 'super_secret_fallback_key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 86400000 // 1 day
    }
}));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// DEBUG: Let's check which route file is loaded correctly
console.log('DEBUG - authRoutes type:', typeof authRoutes);
console.log('DEBUG - studentRoutes type:', typeof studentRoutes);
console.log('DEBUG - adminRoutes type:', typeof adminRoutes);

// Mount Routes
app.use('/auth', authRoutes);
app.use('/student', studentRoutes);
app.use('/admin', adminRoutes);
app.use('/api/webhook', webhookRoutes);

// Chapa background webhook static assets
app.use('/assets', express.static('assets'));

// Home Route redirect or render
app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/student/dashboard');
    }
    res.redirect('/auth/login');
});

// Import database connection to verify it initializes
require('./config/db');

// 404 Error Handler for undefined routes
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found - Robera Tech',
        message: 'The page or tutorial link you are looking for does not exist.'
    });
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`🚀 Server is running live at http://localhost:${PORT}`);
});