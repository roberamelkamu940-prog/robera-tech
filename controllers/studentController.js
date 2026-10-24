const db = require('../config/db');

// Student Dashboard - View Enrolled Courses & Progress
exports.getDashboard = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Fetch enrolled courses for this student
        const [enrollments] = await db.query(`
            SELECT c.* FROM courses c
            JOIN enrollments e ON c.id = e.course_id
            WHERE e.user_id = ?
        `, [userId]);

        res.render('student/dashboard', { 
            title: 'Student Dashboard - Robera Tech', 
            user: req.session.user,
            enrollments 
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).send('Server Error');
    }
};

// Browse Available Courses
exports.getCourses = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Fetch all published courses and check if student is already enrolled
        const [courses] = await db.query(`
            SELECT c.*, 
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) as is_enrolled
            FROM courses c WHERE c.is_published = TRUE
        `, [userId]);

        res.render('student/courses', { 
            title: 'Course Catalog - Robera Tech', 
            user: req.session.user,
            courses 
        });
    } catch (err) {
        console.error('Courses catalog error:', err);
        res.status(500).send('Server Error');
    }
};

// View Course Lessons (Only if Enrolled or Admin)
exports.viewCourseLessons = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.session.user.id;
        const userRole = req.session.user.role;

        // If not admin, verify enrollment
        if (userRole !== 'admin') {
            const [enrollment] = await db.query(
                'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?', 
                [userId, courseId]
            );
            if (enrollment.length === 0) {
                return res.status(403).render('error', { 
                    title: 'Access Denied', 
                    message: 'You are not enrolled in this course. Please contact administration for access.' 
                });
            }
        }

        // Get course details
        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) return res.status(404).send('Course not found');

        // Get lessons for this course
        const [lessons] = await db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC', [courseId]);

        res.render('student/lesson', {
            title: courses[0].title + ' - Lessons',
            user: req.session.user,
            course: courses[0],
            lessons
        });
    } catch (err) {
        console.error('View course lessons error:', err);
        res.status(500).send('Server Error');
    }
};

// Self-Enroll in Free Courses
exports.enrollCourse = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.session.user.id;

        await db.query('INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [userId, courseId]);
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error('Enrollment error:', err);
        res.status(500).send('Server Error');
    }
};