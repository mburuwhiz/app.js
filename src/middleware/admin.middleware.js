const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Not an admin.' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    logger.error(`Admin JWT verification failed: ${error.message}`);
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = authenticateAdmin;