const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

/**
 * Generate JWT token
 * @param {Object} user - user object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not configured!');
    throw new Error('JWT_SECRET is not configured');
  }
  
  const token = jwt.sign(
    { id: user.id, email: user.email },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  return token;
};

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  console.log('[REGISTER] Attempting registration with:', { 
    name: req.body.name, 
    email: req.body.email,
    bodyKeys: Object.keys(req.body) 
  });

  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[REGISTER] Validation errors:', errors.array());
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('[REGISTER] User already exists:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Create user
    console.log('[REGISTER] Creating user:', { name, email });
    const user = await User.create({ name, email, password });
    console.log('[REGISTER] User created successfully:', { id: user.id, email: user.email });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('[REGISTER ERROR]', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: error.code,
      detail: error.detail,
    });
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed: ' + error.message
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  console.log('[LOGIN] Attempting login with:', { email: req.body.email });

  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[LOGIN] Validation errors:', errors.array());
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user
    console.log('[LOGIN] Looking up user:', email);
    const user = await User.findByEmail(email);
    if (!user) {
      console.log('[LOGIN] User not found:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    console.log('[LOGIN] User found:', { id: user.id, email: user.email });

    // Check password
    console.log('[LOGIN] Comparing password...');
    const isPasswordValid = await User.comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      console.log('[LOGIN] Invalid password for:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    console.log('[LOGIN] Password valid');

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    res.status(500).json({ 
      success: false, 
      message: 'Login failed: ' + error.message
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('[GET_ME ERROR]', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get profile' 
    });
  }
};

module.exports = { register, login, getMe };