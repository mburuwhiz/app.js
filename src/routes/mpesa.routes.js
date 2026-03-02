const express = require('express');
const router = express.Router();
const mpesaController = require('../controllers/mpesa.controller');
const authenticateApiKey = require('../middleware/auth.middleware');

// Trigger STK Push - Protected by API Key
router.post('/stk', authenticateApiKey, mpesaController.stkPush);

// Callback from Safaricom - NOT protected by API Key (must be public for Safaricom)
router.post('/mpesa/callback', mpesaController.stkCallback);

// Poll Payment Status - Could be protected, but keeping public for easy frontend polling in this demo
// Alternatively, require auth if dealing with sensitive user session details
router.get('/stk/status/:checkout', mpesaController.checkStkStatus);

// Expose API Key config securely for frontend (In a real app, this should be a JWT login flow)
router.get('/config', (req, res) => {
  res.json({ apiKey: process.env.API_KEY });
});

module.exports = router;