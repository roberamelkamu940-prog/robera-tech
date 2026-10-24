const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Render Registration Page
exports.getRegister = (req, res) => {
    res.render('auth/register', { title: 'Register - Robera Tech', error: null });
};

// Handle Student Registration
exports.postRegister = async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        // Check if user already exists
        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.render('auth/register', { title: 'Register - Robera Tech', error: 'Email is already registered.' });
        }

        // Hash password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new student into database
        await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', 
            [name, email, hashedPassword, 'student']);

        res.redirect('/auth/login?registered=success');
    } catch (err) {
        console.error('Registration error:', err);
        res.render('auth/register', { title: 'Register - Robera Tech', error: 'An error occurred during registration.' });
    }
};

// Render Login Page
exports.getLogin = (req, res) => {
    const successMsg = req.query.registered === 'success' ? 'Registration successful! Please log in.' : null;
    res.render('auth/login', { title: 'Login - Robera Tech', error: null, success: successMsg });
};

// Handle User Login
exports.postLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.render('auth/login', { title: 'Login - Robera Tech', error: 'Invalid email or password.', success: null });
        }

        const user = users[0];

        // Compare password with hashed password in database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', { title: 'Login - Robera Tech', error: 'Invalid email or password.', success: null });
        }

        // Save user session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        // Redirect based on role
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/student/dashboard');
        }
    } catch (err) {
        console.error('Login error:', err);
        res.render('auth/login', { title: 'Login - Robera Tech', error: 'An error occurred during login.', success: null });
    }
};

// Handle Logout
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
};