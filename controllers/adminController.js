const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Admin Dashboard - Overview of platform stats
exports.getDashboard = async (req, res) => {
    try {
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "student"');
        const [courseCount] = await db.query('SELECT COUNT(*) as count FROM courses');
        const [enrollmentCount] = await db.query('SELECT COUNT(*) as count FROM enrollments');

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - Robera Tech',
            user: req.session.user,
            stats: {
                students: userCount[0].count,
                courses: courseCount[0].count,
                enrollments: enrollmentCount[0].count
            }
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).send('Server Error');
    }
};

// Manage Courses (List all courses & creation form)
exports.getCourses = async (req, res) => {
    try {
        const [courses] = await db.query('SELECT * FROM courses ORDER BY created_at DESC');
        res.render('admin/courses', {
            title: 'Manage Courses - Admin',
            user: req.session.user,
            courses
        });
    } catch (err) {
        console.error('Admin courses error:', err);
        res.status(500).send('Server Error');
    }
};

// Create a new course
exports.postCreateCourse = async (req, res) => {
    try {
        const { title, description, is_published } = req.body;
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const published = is_published ? 1 : 0;

        await db.query('INSERT INTO courses (title, slug, description, is_published) VALUES (?, ?, ?, ?)',
            [title, slug, description, published]);

        res.redirect('/admin/courses');
    } catch (err) {
        console.error('Create course error:', err);
        res.status(500).send('Server Error');
    }
};

// Manage Lessons for a Course
exports.getLessons = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) return res.status(404).send('Course not found');

        const [lessons] = await db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC', [courseId]);

        res.render('admin/lessons', {
            title: 'Manage Lessons - ' + courses[0].title,
            user: req.session.user,
            course: courses[0],
            lessons
        });
    } catch (err) {
        console.error('Admin lessons error:', err);
        res.status(500).send('Server Error');
    }
};

// Add a lesson to a course
exports.postCreateLesson = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const { title, content, video_url, sort_order } = req.body;

        await db.query('INSERT INTO lessons (course_id, title, content, video_url, sort_order) VALUES (?, ?, ?, ?, ?)',
            [courseId, title, content, video_url, sort_order || 0]);

        res.redirect(`/admin/courses/${courseId}/lessons`);
    } catch (err) {
        console.error('Create lesson error:', err);
        res.status(500).send('Server Error');
    }
};