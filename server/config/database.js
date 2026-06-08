const { Pool } = require('pg');
require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env')
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
/**
 * Test database connection and initialize schema
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('  ✓ Database connected');
    return true;
  } catch (err) {
    console.log('  ✗ Database connection failed');
    return false;
  }
}

/**
 * Initialize database schema - creates tables if they don't exist
 */
async function initializeSchema() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema...');
    
    await client.query('BEGIN');

    // Create extension for UUID generation
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Tasks table (with task_order)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        task_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Add task_order column if it doesn't exist (migration)
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tasks' AND column_name = 'task_order'
        ) THEN
          ALTER TABLE tasks ADD COLUMN task_order INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    // Set initial task_order values for existing tasks
    await client.query(`
      UPDATE tasks t
      SET task_order = t2.new_order
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) - 1 as new_order
        FROM tasks
      ) t2
      WHERE t.id = t2.id AND t.task_order IS NULL;
    `);

    // Task completions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_completions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        completion_date DATE NOT NULL,
        completed BOOLEAN DEFAULT TRUE,
        UNIQUE(task_id, completion_date)
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON task_completions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_completions_date ON task_completions(completion_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_completions_user_date ON task_completions(user_id, completion_date)`);

    await client.query('COMMIT');
    console.log('✓ Database schema initialized successfully');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Schema initialization failed:', err.message);
    return false;
  } finally {
    client.release();
  }
}

// Event handlers
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

module.exports = pool;
module.exports.testConnection = testConnection;
module.exports.initializeSchema = initializeSchema;