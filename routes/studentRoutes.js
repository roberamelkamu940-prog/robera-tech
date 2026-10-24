const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isStudent } = require('../middleware/auth');
const { initializeChapaPayment, settleVerifiedPayment } = require('../database/services/paymentServices');

// 1. Student Dashboard Overview
router.get('/dashboard', isAuthenticated, isStudent, async (req, res) => {
    try {
        const userId = req.session.user?.id || 
                       req.session.user?.userId || 
                       req.session.userId || 
                       req.session.user_id;

        if (!userId) {
            return res.redirect('/auth/login');
        }

        const [enrolledCourses] = await db.query(
            `SELECT c.*, COUNT(DISTINCT l.id) AS lesson_count,
                    COUNT(DISTINCT CASE WHEN lp.is_completed = TRUE THEN lp.lesson_id END) AS completed_count
             FROM courses c
             JOIN enrollments e ON c.id = e.course_id
             LEFT JOIN lessons l ON l.course_id = c.id
             LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
             WHERE e.user_id = ?
             GROUP BY c.id`,
            [userId]
        );

        enrolledCourses.forEach(course => {
            course.progress = course.lesson_count
                ? Math.round((course.completed_count / course.lesson_count) * 100)
                : 0;
        });

        res.render('student/dashboard', { 
            title: 'Student Dashboard - Robera Tech',
            user: req.session.user || { id: userId }, 
            enrolledCourses: enrolledCourses || [] 
        });
    } catch (error) {
        console.error('❌ DASHBOARD ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not load your dashboard.' });
    }
});

// 2. Student Course Catalog View
router.get('/courses', async (req, res) => {
    try {
        const searchQuery = String(req.query.search || '').trim();
        const params = [];
        let query = `SELECT c.*,
                            (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
                            EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) AS is_enrolled
                     FROM courses c WHERE c.is_published = TRUE`;
        params.push(req.session.user?.id || 0);
        if (searchQuery) {
            query += ' AND (c.title LIKE ? OR c.description LIKE ? OR c.category LIKE ?)';
            const searchTerm = `%${searchQuery}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        query += ' ORDER BY c.created_at DESC';
        const [courses] = await db.query(query, params);

        res.render('student/courses', {
            title: 'Explore Courses - Robera Tech',
            user: req.session.user || null,
            courses,
            searchQuery
        });
    } catch (error) {
        console.error('❌ CATALOG ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not load course catalog: ${error.message}` });
    }
});

// 3. View Individual Course Details
router.get('/course/:id', isAuthenticated, isStudent, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.session.user?.id || req.session.user?.userId || req.session.userId;

        const [enrollment] = userId
            ? await db.query('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [userId, courseId])
            : [[]];

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
router.get('/learn/:courseId', isAuthenticated, isStudent, async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const userId = req.session.user.id;
        const [enrollments] = await db.query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        if (!enrollments.length) {
            return res.status(403).render('error', {
                title: 'Access Denied',
                message: 'You must enroll in this course to access classroom lessons.'
            });
        }

        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (!courses.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Course not found.' });
        }
        const [lessons] = await db.query(
            'SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC',
            [courseId]
        );
        const [completedRows] = await db.query(
            `SELECT lp.lesson_id FROM lesson_progress lp
             JOIN lessons l ON lp.lesson_id = l.id
             WHERE lp.user_id = ? AND l.course_id = ? AND lp.is_completed = TRUE`,
            [userId, courseId]
        );
        const [quizzes] = await db.query('SELECT id, title FROM quizzes WHERE course_id = ? ORDER BY id ASC', [courseId]);
        const activeLesson = lessons.find(lesson => String(lesson.id) === String(req.query.lesson)) || lessons[0] || null;

        res.render('student/learn', {
            title: `${courses[0].title} - Classroom`,
            user: req.session.user,
            course: courses[0],
            lessons,
            activeLesson,
            completedLessonIds: completedRows.map(row => row.lesson_id),
            quizzes
        });
    } catch (error) {
        console.error('❌ CLASSROOM ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not load the classroom.' });
    }
});

router.get('/profile', isAuthenticated, isStudent, (req, res) => {
    res.render('student/profile', {
        title: 'Account Settings - Robera Tech',
        user: req.session.user
    });
});

router.post('/checkout/:id', isAuthenticated, isStudent, async (req, res) => {
    try {
        const courseId = Number(req.params.id);
        const user = req.session.user;
        const [courses] = await db.query('SELECT * FROM courses WHERE id = ? AND is_published = TRUE', [courseId]);
        if (!courses.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Course not found.' });
        }
        const course = courses[0];
        if (Number(course.price) <= 0) {
            return res.redirect(`/student/enroll/${courseId}`);
        }
        const appBaseUrl = process.env.APP_BASE_URL;
        if (!appBaseUrl) {
            return res.status(503).render('error', {
                title: 'Payments Unavailable',
                message: 'The payment return URL has not been configured. Please contact the site administrator.'
            });
        }

        const [existingEnrollment] = await db.query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
            [user.id, courseId]
        );
        if (existingEnrollment.length) {
            return res.redirect(`/student/learn/${courseId}`);
        }

        const txRef = `robera-${crypto.randomBytes(16).toString('hex')}`;
        const nameParts = String(user.name || 'Student').trim().split(/\s+/);
        const payment = await initializeChapaPayment({
            amount: course.price,
            currency: 'ETB',
            email: user.email,
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(' ') || 'Student',
            tx_ref: txRef,
            callback_url: new URL(`/student/payment/verify/${txRef}`, appBaseUrl).toString(),
            return_url: new URL('/student/dashboard?payment=complete', appBaseUrl).toString(),
            title: 'Robera Tech Course Enrollment',
            description: course.title
        });
        await db.query(
            'INSERT INTO payments (user_id, course_id, tx_ref, amount, status) VALUES (?, ?, ?, ?, ?)',
            [user.id, courseId, txRef, course.price, 'pending']
        );
        return res.redirect(payment.data.checkout_url);
    } catch (error) {
        console.error('❌ CHECKOUT ERROR:', error.message);
        res.status(502).render('error', { title: 'Payment Error', message: 'Could not start this payment. Please try again later.' });
    }
});

router.get('/payment/verify/:tx_ref', async (req, res) => {
    try {
        const result = await settleVerifiedPayment(req.params.tx_ref);
        if (result.success) {
            return res.redirect(`/student/learn/${result.courseId}?payment=complete`);
        }
        res.redirect('/student/dashboard?payment=not_verified');
    } catch (error) {
        console.error('❌ VERIFICATION ERROR:', error.message);
        res.status(502).render('error', {
            title: 'Payment Verification',
            message: 'Payment could not be verified right now. Please contact support before retrying.'
        });
    }
});

// 8. Mark Lesson as Complete & Advance Progress
router.post('/lesson/complete/:id', isAuthenticated, isStudent, async (req, res) => {
    try {
        const lessonId = req.params.id;
        const userId = req.session.user?.id || req.session.user?.userId || req.session.userId;

        const [lessonRows] = await db.query('SELECT id, course_id FROM lessons WHERE id = ?', [lessonId]);
        if (!lessonRows.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Lesson not found.' });
        }
        const [enrollments] = await db.query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, lessonRows[0].course_id]
        );
        if (!enrollments.length) {
            return res.status(403).render('error', { title: 'Access Denied', message: 'Enroll in this course to update lesson progress.' });
        }

        await db.query(
            'INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at) VALUES (?, ?, TRUE, NOW()) ON DUPLICATE KEY UPDATE is_completed = TRUE, completed_at = NOW()',
            [userId, lessonId]
        );
        res.redirect(`/student/learn/${lessonRows[0].course_id}?lesson=${lessonId}`);
    } catch (error) {
        console.error('❌ PROGRESS ERROR:', error.message);
        res.status(500).render('error', { title: 'Error', message: `Could not update progress: ${error.message}` });
    }
});
// Course Catalog with Search Support
// Interactive Classroom Route
router.get('/classroom/:courseId', isAuthenticated, isStudent, async (req, res, next) => {
    try {
        const courseId = req.params.courseId;
        const userId = req.session.user.id;

        const [enrollment] = await db.query(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
            [userId, courseId]
        );
        if (!enrollment.length) {
            return res.status(403).render('error', { title: 'Access Denied', message: 'Enroll in this course to access the classroom.' });
        }
        const [courses] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (courses.length === 0) {
            return res.status(404).render('error', { message: 'Course not found' });
        }

        // Fetch lessons for this course
        const [lessons] = await db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC', [courseId]);

        res.render('student/classroom', {
            course: courses[0],
            lessons,
            user: req.session.user
        });
    } catch (error) {
        next(error);
    }
});

router.post('/enroll/:courseId', isAuthenticated, isStudent, async (req, res) => {
    try {
        const courseId = Number(req.params.courseId);
        const [courses] = await db.query('SELECT id, price FROM courses WHERE id = ? AND is_published = TRUE', [courseId]);
        if (!courses.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Course not found.' });
        }
        if (Number(courses[0].price) > 0) {
            return res.redirect(`/student/checkout/${courseId}`);
        }
        await db.query('INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', [req.session.user.id, courseId]);
        res.redirect(`/student/learn/${courseId}`);
    } catch (error) {
        console.error('Enrollment error:', error.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not enroll in this course.' });
    }
});

router.get('/quiz/:quizId', isAuthenticated, isStudent, async (req, res) => {
    try {
        const quizId = Number(req.params.quizId);
        const [quizRows] = await db.query(
            `SELECT q.id, q.title, q.course_id, c.title AS course_title
             FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE q.id = ?`,
            [quizId]
        );
        if (!quizRows.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Quiz not found.' });
        }
        const quiz = quizRows[0];
        const [enrollments] = await db.query('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [req.session.user.id, quiz.course_id]);
        if (!enrollments.length) {
            return res.status(403).render('error', { title: 'Access Denied', message: 'Enroll in this course to take its quiz.' });
        }
        const [questions] = await db.query(
            'SELECT id, question, option_a, option_b, option_c, option_d FROM quiz_questions WHERE quiz_id = ? ORDER BY id ASC',
            [quizId]
        );
        let attempt = null;
        if (req.query.attempt) {
            const [attemptRows] = await db.query(
                'SELECT score, total_questions, completed_at FROM quiz_attempts WHERE id = ? AND user_id = ? AND quiz_id = ?',
                [req.query.attempt, req.session.user.id, quizId]
            );
            attempt = attemptRows[0] || null;
        }
        res.render('student/quiz', { title: `${quiz.title} - Quiz`, user: req.session.user, quiz, questions, attempt });
    } catch (error) {
        console.error('Quiz load error:', error.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not load this quiz.' });
    }
});

router.post('/quiz/:quizId/submit', isAuthenticated, isStudent, async (req, res) => {
    try {
        const quizId = Number(req.params.quizId);
        const [quizRows] = await db.query('SELECT id, course_id FROM quizzes WHERE id = ?', [quizId]);
        if (!quizRows.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Quiz not found.' });
        }
        const [enrollments] = await db.query('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?', [req.session.user.id, quizRows[0].course_id]);
        if (!enrollments.length) {
            return res.status(403).render('error', { title: 'Access Denied', message: 'Enroll in this course to take its quiz.' });
        }
        const [questions] = await db.query('SELECT id, correct_option FROM quiz_questions WHERE quiz_id = ?', [quizId]);
        if (!questions.length) {
            return res.status(400).redirect(`/student/quiz/${quizId}`);
        }
        const answers = req.body.answers || {};
        if (questions.some(question => !['a', 'b', 'c', 'd'].includes(String(answers[question.id] || '').toLowerCase()))) {
            return res.status(400).redirect(`/student/quiz/${quizId}?error=incomplete`);
        }
        const score = questions.reduce((total, question) =>
            total + (String(answers[question.id]).toLowerCase() === question.correct_option ? 1 : 0), 0);
        const [result] = await db.query(
            'INSERT INTO quiz_attempts (user_id, quiz_id, score, total_questions) VALUES (?, ?, ?, ?)',
            [req.session.user.id, quizId, score, questions.length]
        );
        res.redirect(`/student/quiz/${quizId}?attempt=${result.insertId}`);
    } catch (error) {
        console.error('Quiz submission error:', error.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not save your quiz result.' });
    }
});
module.exports = router;