const mongoose = require('mongoose');

const c2bPaymentSchema = new mongoose.Schema({
  transaction_type: {
    type: String,
    required: true
  },
  trans_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  trans_time: {
    type: String,
    required: true
  },
  trans_amount: {
    type: Number,
    required: true
  },
  business_short_code: {
    type: String,
    required: true
  },
  bill_ref_number: {
    type: String,
    default: null
  },
  invoice_number: {
    type: String,
    default: null
  },
  org_account_balance: {
    type: String,
    default: null
  },
  third_party_trans_id: {
    type: String,
    default: null
  },
  msisdn: {
    type: String,
    required: true
  },
  first_name: {
    type: String,
    default: null
  },
  middle_name: {
    type: String,
    default: null
  },
  last_name: {
    type: String,
    default: null
  },
  raw_payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

const C2BPayment = mongoose.model('C2BPayment', c2bPaymentSchema);

module.exports = C2BPayment;
