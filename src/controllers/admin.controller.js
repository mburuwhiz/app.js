const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Payment = require('../models/payment.model');
const ApiKey = require('../models/api-key.model');
const logger = require('../config/logger');

exports.login = (req, res) => {
  const { username, password } = req.body;

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }

  res.status(401).json({ error: 'Invalid username or password' });
};

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    logger.error(`Error fetching payments for admin: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// API Key Management

exports.getApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 });
    res.json(keys);
  } catch (error) {
    logger.error(`Error fetching API keys: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
};

exports.generateApiKey = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required for an API key.' });
  }

  try {
    // Generate a secure random key
    const key = crypto.randomBytes(32).toString('hex');

    const apiKey = new ApiKey({
      key,
      name
    });

    await apiKey.save();
    res.status(201).json(apiKey);
  } catch (error) {
    logger.error(`Error generating API key: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
};

exports.deleteApiKey = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await ApiKey.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'API Key not found.' });
    }
    res.json({ message: 'API Key deleted successfully.' });
  } catch (error) {
    logger.error(`Error deleting API key: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
};
