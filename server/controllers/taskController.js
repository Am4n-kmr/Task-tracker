const { validationResult } = require('express-validator');
const Task = require('../models/Task');
const TaskCompletion = require('../models/TaskCompletion');

/**
 * Get all tasks for authenticated user
 * GET /api/tasks
 */
const getAllTasks = async (req, res) => {
  try {
    const { search } = req.query;
    let tasks;
    
    if (search) {
      tasks = await Task.search(req.user.id, search);
    } else {
      tasks = await Task.getAllByUser(req.user.id);
    }

    // Get today's completions
    const today = new Date().toISOString().split('T')[0];
    const todayCompletions = await TaskCompletion.getByUserAndDate(req.user.id, today);
    const completedTaskIds = new Set(todayCompletions.map(tc => tc.task_id));

    // Attach today's completion status to each task
    const tasksWithStatus = tasks.map(task => ({
      ...task,
      completed_today: completedTaskIds.has(task.id)
    }));

    res.status(200).json({
      success: true,
      count: tasksWithStatus.length,
      data: tasksWithStatus
    });
  } catch (error) {
    console.error('[TASKS] Error fetching tasks:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tasks: ' + error.message
    });
  }
};

/**
 * Create a new task
 * POST /api/tasks
 */
const createTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    const { title } = req.body;
    
    const task = await Task.create({ user_id: req.user.id, title });
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('[TASKS] Error creating task:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create task: ' + error.message
    });
  }
};

/**
 * Update a task
 * PUT /api/tasks/:id
 */
const updateTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { title } = req.body;

    const task = await Task.update(id, req.user.id, { title });
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('[TASKS] Error updating task:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update task: ' + error.message
    });
  }
};

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Task.delete(id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('[TASKS] Error deleting task:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete task: ' + error.message
    });
  }
};

/**
 * Toggle task completion for today
 * POST /api/tasks/:id/toggle
 */
const toggleTaskCompletion = async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // Verify task exists and belongs to user
    const task = await Task.findById(id, req.user.id);
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found' 
      });
    }

    const result = await TaskCompletion.toggle(id, req.user.id, today);

    res.status(200).json({
      success: true,
      message: result.action === 'created' ? 'Task completed' : 'Task uncompleted',
      data: {
        completed: result.action === 'created',
        completion: result.completion
      }
    });
  } catch (error) {
    console.error('[TASKS] Error toggling task:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle task: ' + error.message
    });
  }
};

/**
 * Get monthly tracker data
 * GET /api/tasks/monthly?year=2024&month=1
 */
const getMonthlyTracker = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const tasks = await Task.getAllByUser(req.user.id);
    const completions = await TaskCompletion.getByUserAndMonth(req.user.id, year, month);

    // Organize completions by task_id and date
    const completionMap = {};
    completions.forEach(tc => {
      if (!completionMap[tc.task_id]) {
        completionMap[tc.task_id] = {};
      }
      completionMap[tc.task_id][tc.completion_date] = true;
    });

    // Get last day of month
    const lastDay = new Date(year, month, 0).getDate();

    // Build calendar data
    const calendarData = tasks.map(task => {
      const days = {};
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days[day] = !!(completionMap[task.id] && completionMap[task.id][dateStr]);
      }
      return {
        ...task,
        days
      };
    });

    res.status(200).json({
      success: true,
      data: {
        year,
        month,
        lastDay,
        tasks: calendarData,
        completions
      }
    });
  } catch (error) {
    console.error('[TASKS] Error fetching monthly data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch monthly data: ' + error.message
    });
  }
};

/**
 * Get analytics data
 * GET /api/tasks/analytics?year=2024&month=1
 */
const getAnalytics = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const tasks = await Task.getAllByUser(req.user.id);
    const totalTasks = tasks.length;
    const lastDay = new Date(year, month, 0).getDate();
    const totalDaysInMonth = lastDay;

    // Get daily stats
    const dailyStats = await TaskCompletion.getDailyStats(req.user.id, year, month);
    
    // Build daily involvement percentage for each day
    const dailyPercentages = {};
    dailyStats.forEach(stat => {
      const total = parseInt(stat.total_tasks) || totalTasks;
      const completed = parseInt(stat.completed_count);
      dailyPercentages[stat.completion_date] = total > 0 ? Math.round((completed / total) * 100) : 0;
    });

    // Fill in all days of month
    const dailyChartData = [];
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dailyChartData.push({
        date: dateStr,
        day,
        percentage: dailyPercentages[dateStr] || 0
      });
    }

    // Calculate monthly completion percentage
    let totalPossibleCompletions = totalTasks * totalDaysInMonth;
    let totalActualCompletions = 0;
    dailyStats.forEach(stat => {
      totalActualCompletions += parseInt(stat.completed_count);
    });
    const monthlyCompletionPercentage = totalPossibleCompletions > 0 
      ? Math.round((totalActualCompletions / totalPossibleCompletions) * 100) 
      : 0;

    // Get streak data
    const streaks = await TaskCompletion.getStreaks(req.user.id);

    // Get task stats
    const taskStats = await TaskCompletion.getTaskStats(req.user.id, year, month);

    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        totalDaysInMonth,
        dailyChartData,
        monthlyCompletionPercentage,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        mostCompleted: taskStats.mostCompleted,
        leastCompleted: taskStats.leastCompleted,
        year,
        month
      }
    });
  } catch (error) {
    console.error('[TASKS] Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics: ' + error.message
    });
  }
};

/**
 * Get dashboard stats for quick display
 * GET /api/tasks/dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const tasks = await Task.getAllByUser(req.user.id);
    const totalTasks = tasks.length;
    const today = new Date().toISOString().split('T')[0];
    
    const todayCompletions = await TaskCompletion.getByUserAndDate(req.user.id, today);
    const completedToday = todayCompletions.length;
    const completionPercent = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0;
    
    const streaks = await TaskCompletion.getStreaks(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        completedToday,
        completionPercent,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
      }
    });
  } catch (error) {
    console.error('[TASKS] Error fetching dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard stats' 
    });
  }
};

const getHeatmap = async (req, res) => {
  try {
    const heatmapData = await TaskCompletion.getHeatmapData(req.user.id);
    const totalTasks = (await Task.getAllByUser(req.user.id)).length;

    // Calculate percentages
    const data = heatmapData.map(d => ({
      date: d.completion_date,
      percentage: totalTasks > 0 
        ? Math.round((parseInt(d.completed_count) / totalTasks) * 100) 
        : 0
    }));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[TASKS] Error fetching heatmap:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch heatmap: ' + error.message
    });
  }
};

/**
 * Export data as CSV
 * GET /api/tasks/export/csv?year=2024&month=1
 */
const exportCSV = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const tasks = await Task.getAllByUser(req.user.id);
    const completions = await TaskCompletion.getByUserAndMonth(req.user.id, year, month);
    const lastDay = new Date(year, month, 0).getDate();

    // Build CSV headers
    let csv = 'Task';
    for (let day = 1; day <= lastDay; day++) {
      csv += `,Day ${day}`;
    }
    csv += '\n';

    // Build completion map
    const completionMap = {};
    completions.forEach(tc => {
      if (!completionMap[tc.task_id]) {
        completionMap[tc.task_id] = {};
      }
      completionMap[tc.task_id][tc.completion_date] = true;
    });

    // Add task rows
    tasks.forEach(task => {
      csv += `"${task.title}"`;
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        csv += `,${completionMap[task.id] && completionMap[task.id][dateStr] ? '✓' : ''}`;
      }
      csv += '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=productivity-${year}-${month}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('[TASKS] Error exporting CSV:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export CSV: ' + error.message
    });
  }
};

module.exports = {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskCompletion,
  getMonthlyTracker,
  getAnalytics,
  getDashboardStats,
  getHeatmap,
  exportCSV
};
