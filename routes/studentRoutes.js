const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// 1. Student Dashboard Overview
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user?.id || 
                       req.session.user?.userId || 
                       req.session.userId || 
                       req.session.user_id;

        if (!userId) {
            return res.redirect('/auth/login');
        }

        const [enrolledCourses] = await db.query(
            `SELECT c.* FROM courses c 
             JOIN enrollments e ON c.id = e.course_id 
             WHERE e.user_id = ?`,
            [userId]
        );

        res.render('student/dashboard', { 
            title: 'Student Dashboard - Robera Tech',
            user: req.session.user || { id: userId }, 
            enrolledCourses: enrolledCourses || [] 
        });
    } catch (error) {
        console.error('❌ DASHBOARD ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Dashboard Error: ${error.message}` });
    }
});

// 2. Student Course Catalog View
router.get('/courses', async (req, res) => {
    try {
        const [courses] = await db.query(
            `SELECT c.*, u.name AS instructor_name, 
                    (SELECT COUNT(*) FROM lessons l JOIN sections s ON l.section_id = s.id WHERE s.course_id = c.id) AS lesson_count
             FROM courses c
             LEFT JOIN users u ON c.instructor_id = u.id
             ORDER BY c.created_at DESC`
        );

        res.render('student/courses', {
            title: 'Explore Courses - Robera Tech',
            user: req.session.user || null,
            courses
        });
    } catch (error) {
        console.error('❌ CATALOG ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not load course catalog: ${error.message}` });
    }
});

// 3. View Individual Course Details
router.get('/course/:id', isAuthenticated, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.session.user?.id || req.session.user?.userId || req.session.userId;

        const [enrollment] = await db.query(
            'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);

        if (!courses || courses.length === 0) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Course not found.' });
        }

        res.render('student/course-detail', {
            title: `${courses[0].title} - Robera Tech`,
            user: req.session.user || {},
            course: courses[0],
            isEnrolled: enrollment && enrollment.length > 0
        });
    } catch (error) {
        console.error('❌ COURSE DETAIL ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Internal Error: ${error.message}` });
    }
});

// 4. Interactive Classroom / Learn View
router.get('/learn/:courseId', isAuthenticated, async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const userId = req.session.user?.id || req.session.user?.userId || req.session.userId;
        const currentLessonId = req.query.lesson || null;

        // Verify Enrollment
        const [enrollment] = await db.query(
            'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        if (enrollment.length === 0) {
            return res.status(403).render('error', { 
                title: 'Access Denied', 
                message: 'You must enroll in this course to access classroom lessons.' 
            });
        }

        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        const course = courses[0];

        const [sections] = await db.query(
            'SELECT * FROM sections WHERE course_id = ? ORDER BY section_order ASC', 
            [courseId]
        );

        let activeLesson = null;
        let completedLessonIds = [];

        const [completedRows] = await db.query(
            `SELECT lp.lesson_id FROM lesson_progress lp
             JOIN lessons l ON lp.lesson_id = l.id
             JOIN sections s ON l.section_id = s.id
             WHERE lp.user_id = ? AND s.course_id = ? AND lp.is_completed = TRUE`,
            [userId, courseId]
        );
        completedLessonIds = completedRows.map(row => row.lesson_id);

        for (let section of sections) {
            const [lessons] = await db.query(
                'SELECT * FROM lessons WHERE section_id = ? ORDER BY lesson_order ASC', 
                [section.id]
            );
            section.lessons = lessons;

            if (!activeLesson && lessons.length > 0) {
                if (currentLessonId) {
                    activeLesson = lessons.find(l => l.id == currentLessonId) || activeLesson;
                }
                if (!activeLesson && !currentLessonId) {
                    activeLesson = lessons[0];
                }
            }
        }

        res.render('student/learn', {
            title: `${course.title} - Classroom`,
            user: req.session.user || {},
            course,
            sections,
            activeLesson,
            completedLessonIds
        });
    } catch (error) {
        console.error('❌ CLASSROOM ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not load classroom: ${error.message}` });
    }
});

// 5. Student Profile
router.get('/profile', isAuthenticated, (req, res) => {
    res.render('student/profile', {
        title: 'Account Settings - Robera Tech',
        user: req.session.user || {}
    });
});

// 6. Handle Chapa Checkout & Payment Initiation
// Safe Chapa Initialization
let chapa = null;
try {
    const Chapa = require('chapa-nodejs');
    const secretKey = process.env.CHAPA_SECRET_KEY;
    
    if (secretKey && !secretKey.includes('xxxx')) {
        chapa = new Chapa({ secretKey });
        console.log('✅ Chapa payment gateway initialized.');
    } else {
        console.warn('⚠️ Chapa running in dummy/test mode (Invalid or placeholder key detected).');
    }
} catch (err) {
    console.warn('⚠️ Chapa failed to initialize:', err.message);
}
router.get('/checkout/:id', isAuthenticated, async (req, res) => {
    try {
        const Chapa = require('chapa-nodejs'); // or axios calling Chapa API
const chapa = new Chapa({ secretKey: process.env.CHAPA_SECRET_KEY });
        const courseId = req.params.id;
        const userId = req.session.user?.id || req.session.user?.userId || req.session.userId;

        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (!courses || courses.length === 0) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Course not found.' });
        }
        const course = courses[0];

        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const student = users[0] || req.session.user;

        const tx_ref = `robera-tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const chapaData = {
            amount: course.price || 500,
            currency: 'ETB',
            email: student.email || 'student@roberatech.com',
            first_name: student.name ? student.name.split(' ')[0] : 'Student',
            last_name: student.name ? student.name.split(' ').slice(1).join(' ') : 'User',
            tx_ref: tx_ref,
            callback_url: `http://localhost:3000/student/payment/verify/${tx_ref}`,
            return_url: `http://localhost:3000/student/dashboard?status=success`
        };

        const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(chapaData)
        });

        const data = await response.json();

        if (data.status === 'success') {
            await db.query(
                'INSERT INTO transactions (user_id, course_id, tx_ref, amount, status) VALUES (?, ?, ?, ?, ?)',
                [userId, courseId, tx_ref, course.price || 500, 'pending']
            );
            
            return res.redirect(data.data.checkout_url);
        } else {
            console.error('Chapa API Error:', data);
            res.status(500).render('error', { title: 'Payment Error', message: 'Could not initialize Chapa payment gateway.' });
        }
    } catch (error) {
        console.error('❌ CHECKOUT ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Checkout Error: ${error.message}` });
    }
});

// 7. Verify Chapa Payment & Enroll Student Automatically
router.get('/payment/verify/:tx_ref', async (req, res) => {
    try {
        const { tx_ref } = req.params;

        const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`
            }
        });

        const data = await response.json();

        if (data.status === 'success') {
            const [txs] = await db.query('SELECT * FROM transactions WHERE tx_ref = ?', [tx_ref]);
            
            if (txs && txs.length > 0) {
                const tx = txs[0];

                await db.query('UPDATE transactions SET status = ? WHERE tx_ref = ?', ['success', tx_ref]);

                await db.query(
                    'INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
                    [tx.user_id, tx.course_id]
                );

                return res.redirect(`/student/learn/${tx.course_id}?success=enrolled`);
            }
        } else {
            await db.query('UPDATE transactions SET status = ? WHERE tx_ref = ?', ['failed', tx_ref]);
        }

        res.redirect('/student/dashboard');
    } catch (error) {
        console.error('❌ VERIFICATION ERROR:', error.message);
        res.redirect('/student/dashboard');
    }
});

// 8. Mark Lesson as Complete & Advance Progress
router.post('/lesson/complete/:id', isAuthenticated, async (req, res) => {
    try {
        const lessonId = req.params.id;
        const userId = req.session.user?.id || req.session.user?.userId || req.session.userId;

        await db.query(
            'INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at) VALUES (?, ?, TRUE, NOW()) ON DUPLICATE KEY UPDATE is_completed = TRUE, completed_at = NOW()',
            [userId, lessonId]
        );

        const [lessonData] = await db.query(
            `SELECT s.course_id FROM lessons l 
             JOIN sections s ON l.section_id = s.id 
             WHERE l.id = ?`,
            [lessonId]
        );

        if (lessonData.length > 0) {
            return res.redirect(`/student/learn/${lessonData[0].course_id}`);
        }

        res.redirect('/student/dashboard');
    } catch (error) {
        console.error('❌ PROGRESS ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not update progress: ${error.message}` });
    }
});
// Course Catalog with Search Support
router.get('/courses', isAuthenticated, async (req, res, next) => {
    try {
        const searchQuery = req.query.search || '';
        let query = 'SELECT * FROM courses';
        let params = [];

        if (searchQuery) {
            query += ' WHERE title LIKE ? OR description LIKE ? OR category LIKE ?';
            const searchTerm = `%${searchQuery}%`;
            params = [searchTerm, searchTerm, searchTerm];
        }

        const [courses] = await db.query(query, params);

        res.render('student/catalog', {
            title: 'Course Catalog',
            user: req.session.user,
            courses,
            searchQuery
        });
    } catch (error) {
        next(error);
    }
});
// Interactive Classroom Route
router.get('/classroom/:courseId', isAuthenticated, async (req, res, next) => {
    try {
        const courseId = req.params.courseId;
        const userId = req.session.user.id;

        // Optional: Verify student is enrolled before letting them watch
        const [enrollment] = await db.query(
            'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );

        // For testing convenience, if not enrolled yet, we can bypass or redirect. 
        // Let's fetch the course details:
        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) {
            return res.status(404).render('error', { message: 'Course not found' });
        }

        // Fetch lessons for this course
        const [lessons] = await db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC', [courseId]);

        res.render('student/classroom', {
            course: courses[0],
            lessons,
            user: req.session.user
        });
    } catch (error) {
        next(error);
    }
});
module.exports = router;