const db = require('../config/db');

// Admin Dashboard - Overview of platform stats
exports.getDashboard = async (req, res) => {
    try {
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "student"');
        const [courseCount] = await db.query('SELECT COUNT(*) as count FROM courses');
        const [enrollmentCount] = await db.query('SELECT COUNT(*) as count FROM enrollments');
        const [lessonCount] = await db.query('SELECT COUNT(*) as count FROM lessons');

        res.render('admin/dashboard', {
            title: 'Admin Dashboard - Robera Tech',
            user: req.session.user,
            stats: {
                students: userCount[0].count,
                courses: courseCount[0].count,
                enrollments: enrollmentCount[0].count,
                lessons: lessonCount[0].count
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
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const category = String(req.body.category || 'General').trim() || 'General';
        const price = Number(req.body.price || 0);
        const level = ['Beginner', 'Intermediate', 'Advanced'].includes(req.body.level) ? req.body.level : 'Beginner';
        const published = req.body.is_published ? 1 : 0;
        if (!title || title.length > 150 || !description || !Number.isFinite(price) || price < 0) {
            return res.status(400).redirect('/admin/courses?error=invalid_course');
        }
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'course'}-${Date.now().toString(36)}`;

        await db.query('INSERT INTO courses (title, slug, description, category, price, level, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, slug, description, category, price, level, published]);

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

        const [lessons] = await db.query('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC, id ASC', [courseId]);
        const [quizzes] = await db.query(
            `SELECT q.id, q.title, COUNT(qq.id) AS question_count
             FROM quizzes q LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
             WHERE q.course_id = ? GROUP BY q.id ORDER BY q.id ASC`,
            [courseId]
        );

        res.render('admin/lessons', {
            title: 'Manage Lessons - ' + courses[0].title,
            user: req.session.user,
            course: courses[0],
            lessons,
            quizzes
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
        const lessonTitle = String(title || '').trim();
        const videoUrl = String(video_url || '').trim();
        const parsedOrder = Number.parseInt(sort_order, 10);
        if (!lessonTitle || lessonTitle.length > 150 || (videoUrl && !/^https?:\/\//i.test(videoUrl))) {
            return res.status(400).redirect(`/admin/courses/${courseId}/lessons?error=invalid_lesson`);
        }

        await db.query('INSERT INTO lessons (course_id, title, content, video_url, sort_order) VALUES (?, ?, ?, ?, ?)',
            [courseId, lessonTitle, String(content || '').trim(), videoUrl, Number.isInteger(parsedOrder) ? parsedOrder : 0]);

        res.redirect(`/admin/courses/${courseId}/lessons`);
    } catch (err) {
        console.error('Create lesson error:', err);
        res.status(500).send('Server Error');
    }
};

exports.getStudents = async (req, res) => {
    try {
        const [students] = await db.query(
            `SELECT u.id, u.name, u.email, u.created_at, COUNT(e.id) AS enrollment_count
             FROM users u
             LEFT JOIN enrollments e ON e.user_id = u.id
             WHERE u.role = 'student'
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );
        res.render('admin/students', {
            title: 'Manage Students - Admin',
            user: req.session.user,
            students
        });
    } catch (err) {
        console.error('Admin students error:', err.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not load student accounts.' });
    }
};

exports.postCreateQuiz = async (req, res) => {
    const courseId = Number(req.params.courseId);
    const title = String(req.body.title || '').trim();
    if (!title || title.length > 150) {
        return res.status(400).redirect(`/admin/courses/${courseId}/lessons?error=invalid_quiz`);
    }
    try {
        await db.query('INSERT INTO quizzes (course_id, title) VALUES (?, ?)', [courseId, title]);
        res.redirect(`/admin/courses/${courseId}/lessons`);
    } catch (err) {
        console.error('Create quiz error:', err.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not create this quiz.' });
    }
};

exports.postCreateQuizQuestion = async (req, res) => {
    const quizId = Number(req.params.quizId);
    try {
        const [quizRows] = await db.query('SELECT course_id FROM quizzes WHERE id = ?', [quizId]);
        if (!quizRows.length) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Quiz not found.' });
        }
        const question = String(req.body.question || '').trim();
        const options = ['option_a', 'option_b', 'option_c', 'option_d'].map(key => String(req.body[key] || '').trim());
        const correctOption = String(req.body.correct_option || '').toLowerCase();
        if (!question || options.some(option => !option) || !['a', 'b', 'c', 'd'].includes(correctOption)) {
            return res.status(400).redirect(`/admin/courses/${quizRows[0].course_id}/lessons?error=invalid_question`);
        }
        await db.query(
            `INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_option)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [quizId, question, ...options, correctOption]
        );
        res.redirect(`/admin/courses/${quizRows[0].course_id}/lessons`);
    } catch (err) {
        console.error('Create quiz question error:', err.message);
        res.status(500).render('error', { title: 'Error', message: 'Could not add this quiz question.' });
    }
};