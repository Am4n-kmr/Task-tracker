const pool = require('../config/database');

class Task {
  /**
   * Get all tasks for a user
   * @param {string} userId
   * @returns {Array} tasks
   */
  static async getAllByUser(userId) {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
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
    const result = await pool.query(
      'INSERT INTO tasks (user_id, title) VALUES ($1, $2) RETURNING *',
      [user_id, title]
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
      'SELECT * FROM tasks WHERE user_id = $1 AND title ILIKE $2 ORDER BY created_at DESC',
      [userId, `%${searchTerm}%`]
    );
    return result.rows;
  }
}

module.exports = Task;