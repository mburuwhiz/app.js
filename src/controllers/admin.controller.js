const jwt = require('jsonwebtoken');
const Payment = require('../models/payment.model');
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
