const pool = require('../config/database');

class TaskCompletion {
  /**
   * Get completions for a user on a specific date
   * @param {string} userId
   * @param {string} date - YYYY-MM-DD
   * @returns {Array} completions
   */
  static async getByUserAndDate(userId, date) {
    const result = await pool.query(
      'SELECT * FROM task_completions WHERE user_id = $1 AND completion_date = $2',
      [userId, date]
    );
    return result.rows;
  }

  /**
   * Get all completions for a user in a month
   * @param {string} userId
   * @param {number} year
   * @param {number} month - 1-12
   * @returns {Array} completions with task info
   */
  static async getByUserAndMonth(userId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Calculate last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const result = await pool.query(
      `SELECT tc.*, t.title as task_title 
       FROM task_completions tc 
       JOIN tasks t ON tc.task_id = t.id 
       WHERE tc.user_id = $1 
       AND tc.completion_date >= $2 
       AND tc.completion_date <= $3 
       ORDER BY tc.completion_date, t.title`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Toggle completion for a task on a date
   * @param {string} taskId
   * @param {string} userId
   * @param {string} date - YYYY-MM-DD
   * @returns {Object} { action: 'created'|'deleted', completion }
   */
  static async toggle(taskId, userId, date) {
    // Check if completion exists
    const existing = await pool.query(
      'SELECT * FROM task_completions WHERE task_id = $1 AND user_id = $2 AND completion_date = $3',
      [taskId, userId, date]
    );

    if (existing.rows.length > 0) {
      // Delete existing completion (toggle off)
      await pool.query(
        'DELETE FROM task_completions WHERE id = $1',
        [existing.rows[0].id]
      );
      return { action: 'deleted', completion: null };
    } else {
      // Create new completion (toggle on)
      const result = await pool.query(
        'INSERT INTO task_completions (task_id, user_id, completion_date, completed) VALUES ($1, $2, $3, TRUE) RETURNING *',
        [taskId, userId, date]
      );
      return { action: 'created', completion: result.rows[0] };
    }
  }

  /**
   * Get daily completion stats for a user in a month
   * @param {string} userId
   * @param {number} year
   * @param {number} month - 1-12
   * @returns {Array} daily stats
   */
  static async getDailyStats(userId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const result = await pool.query(
      `SELECT 
        tc.completion_date,
        COUNT(tc.id) as completed_count,
        (SELECT COUNT(*) FROM tasks WHERE user_id = $1) as total_tasks
       FROM task_completions tc
       WHERE tc.user_id = $1 
       AND tc.completion_date >= $2 
       AND tc.completion_date <= $3
       AND tc.completed = TRUE
       GROUP BY tc.completion_date
       ORDER BY tc.completion_date`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Get user's completion streak data
   * @param {string} userId
   * @returns {Object} { currentStreak, longestStreak }
   */
  static async getStreaks(userId) {
    // Get all distinct completion dates sorted
    const result = await pool.query(
      `SELECT DISTINCT completion_date 
       FROM task_completions 
       WHERE user_id = $1 AND completed = TRUE 
       ORDER BY completion_date DESC`,
      [userId]
    );

    const dates = result.rows.map(r => new Date(r.completion_date));
    
    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if today or yesterday is in the dates
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const dateStrs = dates.map(d => d.toISOString().split('T')[0]);
    
    if (dateStrs.includes(todayStr) || dateStrs.includes(yesterdayStr)) {
      let checkDate = dateStrs.includes(todayStr) ? today : yesterday;
      
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (dateStrs.includes(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.abs(
        (dates[i - 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }

  /**
   * Get most and least completed tasks
   * @param {string} userId
   * @param {number} year
   * @param {number} month
   * @returns {Object} { mostCompleted, leastCompleted }
   */
  static async getTaskStats(userId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const result = await pool.query(
      `SELECT 
        t.id, 
        t.title, 
        COUNT(tc.id) as completion_count
       FROM tasks t
       LEFT JOIN task_completions tc ON t.id = tc.task_id 
         AND tc.completion_date >= $2 
         AND tc.completion_date <= $3
         AND tc.completed = TRUE
       WHERE t.user_id = $1
       GROUP BY t.id, t.title
       ORDER BY completion_count DESC`,
      [userId, startDate, endDate]
    );

    const tasks = result.rows;
    if (tasks.length === 0) {
      return { mostCompleted: null, leastCompleted: null };
    }

    return {
      mostCompleted: tasks[0],
      leastCompleted: tasks[tasks.length - 1]
    };
  }

  /**
   * Get heatmap data for the past year
   * @param {string} userId
   * @returns {Array} daily completion percentages
   */
  static async getHeatmapData(userId) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT 
        tc.completion_date,
        COUNT(tc.id) as completed_count,
        (SELECT COUNT(*) FROM tasks WHERE user_id = $1) as total_tasks
       FROM task_completions tc
       WHERE tc.user_id = $1 
       AND tc.completion_date >= $2
       AND tc.completed = TRUE
       GROUP BY tc.completion_date
       ORDER BY tc.completion_date`,
      [userId, startDate]
    );

    return result.rows;
  }
}

module.exports = TaskCompletion;