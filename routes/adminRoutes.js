const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated, isAdmin);

router.get('/dashboard', adminController.getDashboard);
router.get('/courses', adminController.getCourses);
router.post('/courses', adminController.postCreateCourse);
router.get('/courses/:courseId/lessons', adminController.getLessons);
router.post('/courses/:courseId/lessons', adminController.postCreateLesson);
router.post('/courses/:courseId/quizzes', adminController.postCreateQuiz);
router.post('/quizzes/:quizId/questions', adminController.postCreateQuizQuestion);
router.get('/students', adminController.getStudents);
router.get('/courses/:courseId/builder', (req, res) => {
    res.redirect(`/admin/courses/${req.params.courseId}/lessons`);
});

module.exports = router;