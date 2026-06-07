const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * Create a new user
   * @param {Object} userData - { name, email, password }
   * @returns {Object} created user
   */
  static async create({ name, email, password }) {
    console.log('[User.create] Hashing password...');
    const password_hash = await bcrypt.hash(password, 10);
    console.log('[User.create] Inserting user into database...');
    
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, password_hash]
    );
    
    console.log('[User.create] User created:', { id: result.rows[0].id, email: result.rows[0].email });
    return result.rows[0];
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Object|null} user or null
   */
  static async findByEmail(email) {
    console.log('[User.findByEmail] Looking up:', email);
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    console.log('[User.findByEmail] Result:', result.rows.length > 0 ? 'found' : 'not found');
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   * @param {string} id - UUID
   * @returns {Object|null} user or null
   */
  static async findById(id) {
    console.log('[User.findById] Looking up:', id);
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Compare password with hash
   * @param {string} password - plain text
   * @param {string} hash - bcrypt hash
   * @returns {boolean}
   */
  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

module.exports = User;