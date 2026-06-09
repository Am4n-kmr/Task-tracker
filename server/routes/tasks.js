const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskCompletion,
  toggleTaskCompletionByDate,
  getMonthlyTracker,
  getAnalytics,
  getDashboardStats,
  getDashboardHistory,
  getHeatmap,
  exportCSV,
  reorderTask,
  swapTaskOrder
} = require('../controllers/taskController');

const router = express.Router();

// All task routes require authentication
router.use(authenticate);

// Validation rules
const taskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Task title must be between 1 and 255 characters')
];

// Routes
router.get('/', getAllTasks);
router.post('/', taskValidation, createTask);

router.put('/swap-order', swapTaskOrder);

router.get('/monthly', getMonthlyTracker);
router.get('/analytics', getAnalytics);
router.get('/dashboard', getDashboardStats);
router.get('/dashboard-history', getDashboardHistory);
router.get('/heatmap', getHeatmap);
router.get('/export/csv', exportCSV);

router.put('/:id', taskValidation, updateTask);
router.put('/:id/reorder', reorderTask);
router.delete('/:id', deleteTask);
router.post('/:id/toggle', toggleTaskCompletion);
router.post('/:id/toggle-by-date', toggleTaskCompletionByDate);

module.exports = router;