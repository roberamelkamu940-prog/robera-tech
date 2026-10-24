const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(isAuthenticated, isAdmin);

router.get('/dashboard', adminController.getDashboard);
router.get('/courses', adminController.getCourses);
router.post('/courses', adminController.postCreateCourse);
router.get('/courses/:courseId/lessons', adminController.getLessons);
router.post('/courses/:courseId/lessons', adminController.postCreateLesson);
// 1. Render Section & Lesson Builder Form
router.get('/admin/courses/:id/builder', isAuthenticated, async (req, res) => {
    try {
        const courseId = req.params.id;

        // Fetch course details
        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) return res.status(404).render('error', { title: 'Not Found', message: 'Course not found.' });

        // Fetch existing sections and their lessons
        const [sections] = await db.query('SELECT * FROM sections WHERE course_id = ? ORDER BY section_order ASC', [courseId]);
        
        for (let section of sections) {
            const [lessons] = await db.query('SELECT * FROM lessons WHERE section_id = ? ORDER BY lesson_order ASC', [section.id]);
            section.lessons = lessons;
        }

        res.render('admin/builder', {
            title: `Manage Content - ${courses[0].title}`,
            course: courses[0],
            sections
        });
    } catch (error) {
        console.error('❌ BUILDER LOAD ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not load builder: ${error.message}` });
    }
});

// 2. Handle Adding a Section (Module)
router.post('/admin/courses/:id/section', isAuthenticated, async (req, res) => {
    try {
        const courseId = req.params.id;
        const { title, section_order } = req.body;

        await db.query(
            'INSERT INTO sections (course_id, title, section_order) VALUES (?, ?, ?)',
            [courseId, title, section_order || 1]
        );

        res.redirect(`/admin/courses/${courseId}/builder?success=section_added`);
    } catch (error) {
        console.error('❌ SECTION ADD ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not add section: ${error.message}` });
    }
});

// 3. Handle Adding a Lesson to a Section
router.post('/admin/sections/:sectionId/lesson', isAuthenticated, async (req, res) => {
    try {
        const sectionId = req.params.sectionId;
        const { title, content, lesson_order, video_url } = req.body;

        // Find course_id for redirection
        const [sectionRows] = await db.query('SELECT course_id FROM sections WHERE id = ?', [sectionId]);
        const courseId = sectionRows[0]?.course_id;

        await db.query(
            'INSERT INTO lessons (section_id, title, content, lesson_order, video_url) VALUES (?, ?, ?, ?, ?)',
            [sectionId, title, content, lesson_order || 1, video_url || '']
        );

        res.redirect(`/admin/courses/${courseId}/builder?success=lesson_added`);
    } catch (error) {
        console.error('❌ LESSON ADD ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not add lesson: ${error.message}` });
    }
});

module.exports = router;