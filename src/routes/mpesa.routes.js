const express = require('express');
const router = express.Router();
const mpesaController = require('../controllers/mpesa.controller');
const authenticateApiKey = require('../middleware/auth.middleware');
const authenticateAdmin = require('../middleware/admin.middleware');
const adminController = require('../controllers/admin.controller');

// --- MPESA CUSTOMER FACING ENDPOINTS ---

// Initiate STK Push - Protected by API Key
router.post('/mpesa/stkpush', authenticateApiKey, mpesaController.stkPush);

// Poll Payment Status - Protected by API Key
router.get('/mpesa/status/:checkoutRequestID', authenticateApiKey, mpesaController.checkStkStatus);

// Callback from Safaricom - NOT protected by API Key (must be public for Safaricom)
router.post('/mpesa/callback', mpesaController.stkCallback);


// --- ADMIN ENDPOINTS ---

// Admin Authentication
router.post('/admin/login', adminController.login);

// Fetch all payments (protected by Admin JWT)
router.get('/admin/payments', authenticateAdmin, adminController.getPayments);

// API Key Management (protected by Admin JWT)
router.get('/admin/api-keys', authenticateAdmin, adminController.getApiKeys);
router.post('/admin/api-keys', authenticateAdmin, adminController.generateApiKey);
router.delete('/admin/api-keys/:id', authenticateAdmin, adminController.deleteApiKey);

// Expose legacy API Key config if still needed (In a real app, this should be removed once migrated)
router.get('/config', (req, res) => {
  res.json({ apiKey: process.env.API_KEY });
});

module.exports = router;
