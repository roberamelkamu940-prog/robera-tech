module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session && req.session.user) {
            return next();
        }
        return res.redirect('/auth/login');
    },

    isAdmin: (req, res, next) => {
        if (req.session && req.session.user && req.session.user.role === 'admin') {
            return next();
        }
        return res.status(403).render('error', { 
            title: 'Access Denied', 
            message: 'Unauthorized: Administrator privileges are required to access this area.' 
        });
    }
};