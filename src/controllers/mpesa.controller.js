const mpesaService = require('../services/mpesa.service');
const Payment = require('../models/payment.model');
const logger = require('../config/logger');

exports.stkPush = async (req, res) => {
  try {
    const { amount, phoneNumber, accountReference, transactionDesc } = req.body;

    if (!amount || !phoneNumber || !accountReference) {
      return res.status(400).json({ error: 'Missing required parameters (amount, phoneNumber, accountReference)' });
    }

    const desc = transactionDesc || accountReference;

    const stkResponse = await mpesaService.initiateStkPush(phoneNumber, amount, accountReference, desc);

    const checkoutRequestId = stkResponse.CheckoutRequestID;
    const merchantRequestId = stkResponse.MerchantRequestID;

    // Save initial pending payment record
    const payment = new Payment({
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      phone: mpesaService.normalizePhone(phoneNumber),
      amount: amount,
      status: 'pending'
    });

    await payment.save();

    // App expects: { CheckoutRequestID: "...", ResponseCode: "0", ResponseDescription: "..." }
    res.json({
      CheckoutRequestID: checkoutRequestId,
      ResponseCode: stkResponse.ResponseCode || "0",
      ResponseDescription: stkResponse.ResponseDescription || "Success. Request accepted for processing"
    });
  } catch (error) {
    logger.error(`STK Push Controller Error: ${error.message}`);
    res.status(500).json({ message: 'Failed to initiate STK Push', details: error.message });
  }
};

exports.stkCallback = async (req, res) => {
  logger.info('MPESA Callback Received');
  logger.info(JSON.stringify(req.body));

  try {
    const data = req.body;

    // Safaricom might hit this endpoint with unexpected payloads, always check structure
    if (!data.Body || !data.Body.stkCallback) {
      logger.warn('Invalid MPESA Callback Payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const callback = data.Body.stkCallback;
    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    // Acknowledge receipt immediately to avoid timeouts
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    let status = 'failed';
    let amount = null;
    let mpesaReceiptNumber = null;
    let phone = null;

    if (resultCode === 0 && callback.CallbackMetadata && callback.CallbackMetadata.Item) {
      status = 'success';
      const metadata = callback.CallbackMetadata.Item;

      const getMetaValue = (name) => {
        const item = metadata.find((i) => i.Name === name);
        return item ? item.Value : null;
      };

      amount = getMetaValue('Amount');
      mpesaReceiptNumber = getMetaValue('MpesaReceiptNumber');
      phone = getMetaValue('PhoneNumber');
    }

    // Process payment updates
    await processPaymentCallback({
      checkoutRequestId,
      status,
      amount,
      mpesaReceiptNumber,
      phone,
      resultDesc,
      rawPayload: data,
      resultCode: resultCode
    });

  } catch (error) {
    logger.error(`Callback Processing Error: ${error.message}`);
    // Already responded to Safaricom, so just log it.
  }
};

const processPaymentCallback = async ({ checkoutRequestId, status, amount, mpesaReceiptNumber, phone, resultDesc, rawPayload, resultCode }) => {
  try {
    // Find and update the payment document
    const payment = await Payment.findOne({ checkout_request_id: checkoutRequestId });

    if (!payment) {
      logger.warn(`Received callback for unknown CheckoutRequestID: ${checkoutRequestId}`);

      // If we don't have a record, maybe we create one?
      // Safaricom callbacks can be delayed, so the initial STK response might not have saved yet
      // (though rare if using MongoDB). For safety, we'll create a record if it's missing.
      const newPayment = new Payment({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: rawPayload.Body.stkCallback.MerchantRequestID,
        phone: phone || 'Unknown',
        amount: amount || 0,
        status: status,
        mpesa_receipt_number: mpesaReceiptNumber,
        result_desc: resultDesc,
        raw_callback_payload: rawPayload,
        result_code: resultCode
      });
      await newPayment.save();
      return;
    }

    // Update existing payment
    payment.status = status;
    payment.result_desc = resultDesc;
    payment.raw_callback_payload = rawPayload;
    payment.result_code = resultCode;

    if (status === 'success') {
      payment.mpesa_receipt_number = mpesaReceiptNumber;
      if (amount) payment.amount = amount;
    }

    await payment.save();
    logger.info(`Payment status updated to ${status} for ${checkoutRequestId}`);

  } catch (error) {
    logger.error(`Database Update Error in Callback: ${error.message}`);
  }
};

exports.checkStkStatus = async (req, res) => {
  const { checkoutRequestID } = req.params;
  try {
    const payment = await Payment.findOne({ checkout_request_id: checkoutRequestID });
    if (!payment) {
      // Scenario C: Return error status (404) for pending status polling
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Backend should return "completed" for success
    const displayStatus = payment.status === 'success' ? 'completed' : payment.status;

    // App expects { status, ResultCode, receiptNumber } for completed
    // Or { status, ResultCode, ResultDesc } for failed
    const response = {
      status: displayStatus,
      ResultCode: payment.result_code !== undefined ? payment.result_code : (payment.status === 'pending' ? null : (payment.status === 'success' ? 0 : 1)),
      receiptNumber: payment.mpesa_receipt_number,
      MpesaReceiptNumber: payment.mpesa_receipt_number, // Compatibility
      ResultDesc: payment.result_desc,
      amount: payment.amount,
      updatedAt: payment.updatedAt,
      phone: payment.phone,
      name: payment.name
    };

    // If still pending, the app might want to keep polling.
    // Documentation says Scenario C: HTTP 404 or HTTP 200 with non-final status.
    if (payment.status === 'pending') {
       // Just return pending status with 200, app will continue polling if it's not completed/failed
       return res.json(response);
    }

    res.json(response);
  } catch (error) {
    logger.error(`Check STK Status Error: ${error.message}`);
    res.status(500).json({ message: 'Failed to retrieve status' });
  }
};
