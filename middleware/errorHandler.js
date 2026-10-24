const errorHandler = (err, req, res, next) => {
    // Log the full error stack to the server console/file
    console.error('🔥 GLOBAL ERROR CATCHER:', err.stack || err.message);

    // Determine status code (default to 500 Internal Server Error)
    const statusCode = err.status || 500;
    const message = err.message || 'An unexpected internal server error occurred.';

    // Render a professional error view
    res.status(statusCode).render('error', {
        title: 'Error - Robera Tech',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong on our end. Please try again later.' 
            : message // Show detailed error message only during development
    });
};

module.exports = errorHandler;