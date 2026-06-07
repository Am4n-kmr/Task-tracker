const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[AUTH] No token provided in request');
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[AUTH] JWT_SECRET is not configured on server');
      return res.status(500).json({ 
        success: false, 
        message: 'Server authentication configuration error.' 
      });
    }

    console.log('[AUTH] Verifying token...');
    const decoded = jwt.verify(token, secret);
    console.log('[AUTH] Token verified for user:', decoded.id);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      console.warn('[AUTH] User not found for token:', decoded.id);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    console.log('[AUTH] Authenticated user:', user.email);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.warn('[AUTH] Invalid JWT:', error.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      console.warn('[AUTH] Token expired');
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    console.error('[AUTH] Unexpected auth error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error.' 
    });
  }
};

module.exports = { authenticate };