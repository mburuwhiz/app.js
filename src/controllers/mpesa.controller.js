const mpesaService = require('../services/mpesa.service');
const Payment = require('../models/payment.model');
const C2BPayment = require('../models/c2b_payment.model');
const logger = require('../config/logger');

exports.stkPush = async (req, res) => {
  try {
    const { name, amount, phone, accountReference } = req.body;

    if (!amount || !phone || !accountReference) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const transactionDesc = accountReference;

    const stkResponse = await mpesaService.initiateStkPush(phone, amount, accountReference, transactionDesc);

    const checkoutRequestId = stkResponse.CheckoutRequestID;
    const merchantRequestId = stkResponse.MerchantRequestID;

    // Save initial pending payment record
    const payment = new Payment({
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      name: name,
      phone: mpesaService.normalizePhone(phone),
      amount: amount,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      checkout: checkoutRequestId,
      response: stkResponse
    });
  } catch (error) {
    logger.error(`STK Push Controller Error: ${error.message}`);
    res.status(500).json({ error: 'Failed to initiate STK Push', details: error.message });
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
      rawPayload: data
    });

  } catch (error) {
    logger.error(`Callback Processing Error: ${error.message}`);
    // Already responded to Safaricom, so just log it.
  }
};

const processPaymentCallback = async ({ checkoutRequestId, status, amount, mpesaReceiptNumber, phone, resultDesc, rawPayload }) => {
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
        raw_callback_payload: rawPayload
      });
      await newPayment.save();
      return;
    }

    // Update existing payment
    payment.status = status;
    payment.result_desc = resultDesc;
    payment.raw_callback_payload = rawPayload;

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
  const { checkout } = req.params;
  try {
    const payment = await Payment.findOne({ checkout_request_id: checkout });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      status: payment.status,
      amount: payment.amount,
      receipt: payment.mpesa_receipt_number,
      message: payment.result_desc,
      updatedAt: payment.updatedAt,
      phone: payment.phone,
      name: payment.name,
      accountReference: payment.merchant_request_id
    });
  } catch (error) {
    logger.error(`Check STK Status Error: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
};

exports.registerC2bUrl = async (req, res) => {
  try {
    const response = await mpesaService.registerC2bUrl();
    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    logger.error(`C2B Register URL Error: ${error.message}`);
    res.status(500).json({ error: 'Failed to register C2B URLs', details: error.message });
  }
};

exports.c2bValidation = async (req, res) => {
  logger.info('C2B Validation Received');
  logger.info(JSON.stringify(req.body));

  // For C2B, returning ResultCode 0 means accept the transaction
  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });
};

exports.c2bConfirmation = async (req, res) => {
  logger.info('C2B Confirmation Received');
  logger.info(JSON.stringify(req.body));

  try {
    const data = req.body;

    const transaction = {
      transaction_type: data.TransactionType,
      trans_id: data.TransID,
      trans_time: data.TransTime,
      trans_amount: data.TransAmount,
      business_short_code: data.BusinessShortCode,
      bill_ref_number: data.BillRefNumber,
      invoice_number: data.InvoiceNumber,
      org_account_balance: data.OrgAccountBalance,
      third_party_trans_id: data.ThirdPartyTransID,
      msisdn: data.MSISDN,
      first_name: data.FirstName,
      middle_name: data.MiddleName,
      last_name: data.LastName,
      raw_payload: data
    };

    const c2bPayment = new C2BPayment(transaction);
    await c2bPayment.save();

    res.json({
      ResultCode: 0,
      ResultDesc: "Success"
    });
  } catch (error) {
    logger.error(`C2B Confirmation Processing Error: ${error.message}`);
    // Respond to Safaricom even on error, they just want an acknowledgement
    res.json({
      ResultCode: 0,
      ResultDesc: "Success"
    });
  }
};
