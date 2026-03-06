const express = require('express');
const router = express.Router();
const mpesaController = require('../controllers/mpesa.controller');
const authenticateApiKey = require('../middleware/auth.middleware');
const authenticateAdmin = require('../middleware/admin.middleware');
const adminController = require('../controllers/admin.controller');

// Trigger STK Push - Protected by API Key
router.post('/stk', authenticateApiKey, mpesaController.stkPush);

// Callback from Safaricom - NOT protected by API Key (must be public for Safaricom)
router.post('/mpesa/callback', mpesaController.stkCallback);

// Admin Authentication
router.post('/admin/login', adminController.login);

// Fetch all payments (protected by Admin JWT)
router.get('/admin/payments', authenticateAdmin, adminController.getPayments);

// Poll Payment Status - Could be protected, but keeping public for easy frontend polling in this demo
// Alternatively, require auth if dealing with sensitive user session details
router.get('/stk/status/:checkout', mpesaController.checkStkStatus);

// Expose API Key config securely for frontend (In a real app, this should be a JWT login flow)
router.get('/config', (req, res) => {
  res.json({ apiKey: process.env.API_KEY });
});

module.exports = router;