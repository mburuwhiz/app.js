const ApiKey = require('../models/api-key.model');
const logger = require('../config/logger');

const authenticateApiKey = async (req, res, next) => {
  let apiKey = req.header('X-API-Key');

  // Also check Authorization: Bearer [key]
  const authHeader = req.header('Authorization');
  if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.replace('Bearer ', '');
  }

  // Fallback to query param if needed (useful for quick testing)
  if (!apiKey) {
    apiKey = req.query.apiKey;
  }

  if (!apiKey) {
    logger.warn(`API Key missing for path: ${req.path}`);
    return res.status(401).json({ error: 'Access denied. No API Key provided.' });
  }

  try {
    const keyDoc = await ApiKey.findOne({ key: apiKey });

    if (!keyDoc) {
      // For backward compatibility or fallback, check against env variable
      if (apiKey === process.env.API_KEY) {
        return next();
      }
      logger.warn(`Invalid API Key used for path: ${req.path}`);
      return res.status(403).json({ error: 'Access denied. Invalid API Key.' });
    }

    // Update last used timestamp (optional, but good for tracking)
    keyDoc.lastUsedAt = new Date();
    await keyDoc.save();

    next();
  } catch (error) {
    logger.error(`API Key verification failed: ${error.message}`);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authenticateApiKey;
