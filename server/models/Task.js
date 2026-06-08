const pool = require('../config/database');

class Task {
  /**
   * Get all tasks for a user
   * @param {string} userId
   * @returns {Array} tasks
   */
  static async getAllByUser(userId) {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY task_order ASC, created_at ASC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Create a new task
   * @param {Object} taskData - { user_id, title }
   * @returns {Object} created task
   */
  static async create({ user_id, title }) {
    // Get the max task_order for this user
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(task_order), -1) as max_order FROM tasks WHERE user_id = $1',
      [user_id]
    );
    const nextOrder = maxOrderResult.rows[0].max_order + 1;
    
    const result = await pool.query(
      'INSERT INTO tasks (user_id, title, task_order) VALUES ($1, $2, $3) RETURNING *',
      [user_id, title, nextOrder]
    );
    return result.rows[0];
  }

  /**
   * Update a task
   * @param {string} id - task UUID
   * @param {string} userId - user UUID
   * @param {Object} updates - { title }
   * @returns {Object|null} updated task
   */
  static async update(id, userId, { title }) {
    const result = await pool.query(
      'UPDATE tasks SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [title, id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Reorder tasks
   * @param {string} id - task UUID
   * @param {string} userId - user UUID
   * @param {number} newOrder - new order position
   * @returns {Object|null} updated task
   */
  static async reorder(id, userId, newOrder) {
    const result = await pool.query(
      'UPDATE tasks SET task_order = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [newOrder, id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Swap order of two tasks
   * @param {string} userId - user UUID
   * @param {string} taskId1 - first task UUID
   * @param {number} order1 - first task new order
   * @param {string} taskId2 - second task UUID
   * @param {number} order2 - second task new order
   * @returns {boolean} success
   */
  static async swapOrder(userId, taskId1, order1, taskId2, order2) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE tasks SET task_order = $1 WHERE id = $2 AND user_id = $3',
        [order1, taskId1, userId]
      );
      await client.query(
        'UPDATE tasks SET task_order = $1 WHERE id = $2 AND user_id = $3',
        [order2, taskId2, userId]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a task
   * @param {string} id - task UUID
   * @param {string} userId - user UUID
   * @returns {boolean} success
   */
  static async delete(id, userId) {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Find task by ID and user
   * @param {string} id
   * @param {string} userId
   * @returns {Object|null}
   */
  static async findById(id, userId) {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Search tasks by title
   * @param {string} userId
   * @param {string} searchTerm
   * @returns {Array} matching tasks
   */
  static async search(userId, searchTerm) {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 AND title ILIKE $2 ORDER BY task_order ASC, created_at ASC',
      [userId, `%${searchTerm}%`]
    );
    return result.rows;
  }
}

module.exports = Task;