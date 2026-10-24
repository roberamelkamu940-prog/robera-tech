const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Render Registration Page
exports.getRegister = (req, res) => {
    res.render('auth/register', { title: 'Register - Robera Tech', error: null, values: {} });
};

// Handle Student Registration
exports.postRegister = async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const values = { name, email };

    if (!name || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
        return res.status(400).render('auth/register', {
            title: 'Register - Robera Tech',
            error: 'Enter a valid name and email, and use a password with at least 8 characters.',
            values
        });
    }
    
    try {
        const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).render('auth/register', {
                title: 'Register - Robera Tech',
                error: 'Email is already registered.',
                values
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', 
            [name, email, hashedPassword, 'student']);

        res.redirect('/auth/login?registered=success');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).render('auth/register', {
                title: 'Register - Robera Tech',
                error: 'Email is already registered.',
                values
            });
        }
        console.error('Registration error:', err.message);
        res.status(500).render('auth/register', {
            title: 'Register - Robera Tech',
            error: 'An error occurred during registration.',
            values
        });
    }
};

// Render Login Page
exports.getLogin = (req, res) => {
    const successMsg = req.query.registered === 'success' ? 'Registration successful! Please log in.' : null;
    res.render('auth/login', { title: 'Login - Robera Tech', error: null, success: successMsg });
};

// Handle User Login
exports.postLogin = async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    try {
        // Find user by email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).render('auth/login', { title: 'Login - Robera Tech', error: 'Invalid email or password.', success: null });
        }

        const user = users[0];

        // Compare password with hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).render('auth/login', { title: 'Login - Robera Tech', error: 'Invalid email or password.', success: null });
        }

        await new Promise((resolve, reject) => {
            req.session.regenerate(error => error ? reject(error) : resolve());
        });

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        // Redirect based on role
        await new Promise((resolve, reject) => {
            req.session.save(error => error ? reject(error) : resolve());
        });

        res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).render('auth/login', { title: 'Login - Robera Tech', error: 'An error occurred during login.', success: null });
    }
};

// Handle Logout
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err.message);
        }
        res.clearCookie('robera_tech_session');
        res.redirect('/auth/login');
    });
};