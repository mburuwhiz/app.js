const logger = require('../config/logger');

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key') || req.query.apiKey;

  if (!apiKey) {
    logger.warn(`API Key missing for path: ${req.path}`);
    return res.status(401).json({ error: 'Access denied. No API Key provided.' });
  }

  // Check if API key matches the one in environment variables
  // In a real production scenario, you'd likely fetch this from a DB
  // depending on your tenant/user model.
  if (apiKey !== process.env.API_KEY) {
    logger.warn(`Invalid API Key used for path: ${req.path}`);
    return res.status(403).json({ error: 'Access denied. Invalid API Key.' });
  }

  next();
};

module.exports = authenticateApiKey;
