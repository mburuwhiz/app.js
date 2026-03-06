# MPESA STK Push API Service

A production-ready MPESA STK Push platform built with Node.js, Express, and MongoDB. This platform allows organizations to manage API keys and process M-Pesa payments through the Daraja API.

## Frontend Pages

The application includes a built-in admin dashboard for managing payments and API keys.

- **Admin Login:** `/admin.html`
  - Accessible via the root URL or directly at `/admin.html`.
  - Secure login for administrators.
- **Admin Dashboard (Payments):** `/admin.html` (Post-login)
  - View a list of all M-Pesa transactions, including status, amount, phone number, and receipt details.
- **Settings (API Keys):** `/admin.html` (Post-login, Settings tab)
  - Generate, copy, and manage API keys for external applications (like Whiz POS).

## API Documentation

All API requests (except for the M-Pesa callback) require authentication via an API Key.

### Authentication

Include the API key in the headers of your requests:
- `x-api-key: [YOUR_API_KEY]`
- OR `Authorization: Bearer [YOUR_API_KEY]`

---

### 1. Initiate STK Push
Triggers an STK Push to the customer's phone.

- **URL:** `/api/mpesa/stkpush`
- **Method:** `POST`
- **Payload:**
```json
{
  "amount": 1500,
  "phoneNumber": "254712345678",
  "accountReference": "POS-Checkout",
  "transactionDesc": "Payment for items"
}
```
- **Success Response (200):**
```json
{
  "CheckoutRequestID": "ws_CO_1234567890",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing"
}
```

---

### 2. Poll Payment Status
Check if a transaction has been completed or failed.

- **URL:** `/api/mpesa/status/:checkoutRequestID`
- **Method:** `GET`
- **Success Response (200):**
```json
{
  "status": "completed",
  "ResultCode": 0,
  "receiptNumber": "OIQ2ABCDEF"
}
```

---

### 3. M-Pesa Callback
Public endpoint for Safaricom Daraja API to post transaction results.

- **URL:** `/api/mpesa/callback`
- **Method:** `POST`

## Setup & Configuration

1. Install dependencies: `npm install`
2. Configure `.env` with your Safaricom Daraja credentials and MongoDB URL.
3. Start the server: `npm start`
