const axios = require('axios');
const NodeCache = require('node-cache');
const logger = require('../config/logger');

// Cache token for 55 minutes (Safaricom tokens expire in 1 hour)
const tokenCache = new NodeCache({ stdTTL: 3300 });

class MpesaService {
  /**
   * Generates or retrieves an OAuth token
   */
  async getOAuthToken() {
    const cachedToken = tokenCache.get('mpesa_oauth_token');
    if (cachedToken) {
      logger.debug('Using cached MPESA OAuth token');
      return cachedToken;
    }

    try {
      logger.info('Generating new MPESA OAuth token');
      const consumerKey = process.env.MPESA_CONSUMER_KEY;
      const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

      const response = await axios.get(url, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      const token = response.data.access_token;
      tokenCache.set('mpesa_oauth_token', token);
      return token;
    } catch (error) {
      logger.error(`Failed to generate MPESA token: ${error.message}`);
      throw new Error('Could not generate MPESA token');
    }
  }

  /**
   * Initiates the STK Push
   */
  async initiateStkPush(phone, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getOAuthToken();
      const url = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

      const shortCode = process.env.MPESA_SHORTCODE; // 7128505
      const passkey = process.env.MPESA_PASSKEY;
      const partyB = process.env.MPESA_PARTY_B; // 3098707

      const timestamp = this.getTimestamp();
      const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

      // Normalize phone to 254...
      const normalizedPhone = this.normalizePhone(phone);

      const payload = {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: amount,
        PartyA: normalizedPhone,
        PartyB: partyB,
        PhoneNumber: normalizedPhone,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc
      };

      logger.info(`Sending STK Push to ${normalizedPhone} for amount ${amount}`);

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
      logger.error(`STK Push Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Register C2B URLs
   */
  async registerC2BUrls() {
    try {
      const token = await this.getOAuthToken();
      const url = 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl';

      const shortCode = process.env.MPESA_SHORTCODE;

      const payload = {
        ShortCode: shortCode,
        ResponseType: process.env.C2B_RESPONSE_TYPE || 'Completed',
        ConfirmationURL: process.env.C2B_CONFIRMATION_URL,
        ValidationURL: process.env.C2B_VALIDATION_URL
      };

      logger.info(`Registering C2B URLs for shortcode ${shortCode}`);

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
      logger.error(`Register C2B URLs Failed: ${errorMessage}`);
      throw error;
    }
  }

  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  normalizePhone(phone) {
    let p = phone.replace(/\s+/g, '');
    if (p.startsWith('+254')) return p.substring(1);
    if (p.startsWith('0')) return '254' + p.substring(1);
    if (p.startsWith('254')) return p;
    // Assume it's a 9 digit number
    if (p.length === 9) return '254' + p;
    return p;
  }
}

module.exports = new MpesaService();
