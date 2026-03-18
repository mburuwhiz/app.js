const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  transaction_type: {
    type: String,
    enum: ['STK', 'C2B'],
    default: 'STK'
  },
  checkout_request_id: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    index: true
  },
  name: {
    type: String,
    required: false
  },
  phone: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true
  },
  result_code: {
    type: Number,
    default: null
  },
  mpesa_receipt_number: {
    type: String,
    default: null
  },
  raw_callback_payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  result_desc: {
    type: String,
    default: null
  },
  merchant_request_id: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
