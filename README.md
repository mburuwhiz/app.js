# MPESA Integration Server (STK Push & C2B)

This repository provides a complete, production-ready backend for integrating Safaricom's M-Pesa API, built with Node.js, Express, MongoDB, and Socket.io for real-time tracking.

## Connecting External Applications

This server is designed to act as your central payment microservice. You can connect any external application (Frontend web apps, Mobile apps, or other Backend services) to initiate payments and listen for real-time updates.

### 1. Initiating an STK Push (Express Checkout)

To prompt a user to pay via M-Pesa STK Push, your external application needs to make a `POST` request to the `/api/stk` endpoint.

**Endpoint:** `POST /api/stk`
**Headers:** `Authorization: Bearer <Your_API_Key>` (If configured)
**Body (JSON):**
```json
{
  "name": "John Doe",
  "phone": "254712345678",
  "amount": 100,
  "accountReference": "INV-12345"
}
```

**Success Response:**
```json
{
  "success": true,
  "checkout": "ws_CO_27052024103015123456",
  "response": {
    "MerchantRequestID": "12345-67890",
    "CheckoutRequestID": "ws_CO_27052024103015123456",
    "ResponseCode": "0",
    "ResponseDescription": "Success. Request accepted for processing",
    "CustomerMessage": "Success. Request accepted for processing"
  }
}
```
*Save the `checkout` (CheckoutRequestID) returned here. You will use it to track the payment status in real-time.*

---

### 2. Registering C2B URLs (Paybill/Buy Goods directly)

If customers will be paying directly via the M-Pesa menu (without an STK prompt), you must register your Validation and Confirmation URLs with Safaricom once.

**Endpoint:** `POST /api/c2b/register`
**Headers:** `Authorization: Bearer <Admin_JWT>`
**Body:** (Empty)

Ensure your `.env` is configured with the correct `C2B_VALIDATION_URL` and `C2B_CONFIRMATION_URL`.

---

### 3. Real-Time Tracking via WebSockets (Socket.IO)

Instead of polling the server or waiting for a page refresh, your frontend application can connect via WebSockets to receive instant updates the millisecond Safaricom confirms the payment.

**Setup in your External Frontend (HTML/JS example):**

1. Include the Socket.io client library in your frontend:
```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
```

2. Connect to your server and subscribe to the payment ID:
```javascript
// Connect to the Node.js backend URL
const socket = io('https://your-backend-url.com');

// The ID you got from the /api/stk response
const checkoutRequestId = "ws_CO_27052024103015123456";

// Tell the backend to put this client in a "room" for this specific transaction
socket.emit('subscribe_to_payment', checkoutRequestId);

// Listen for the 'payment_status_update' event
socket.on('payment_status_update', (data) => {
    console.log('Payment Update Received!', data);

    if (data.status === 'success') {
        alert(`Payment of KES ${data.amount} received from ${data.phone}. Receipt: ${data.receipt}`);
        // Update UI, redirect to success page, etc.
    } else {
        alert(`Payment failed: ${data.message}`);
    }
});
```

**Tracking C2B Payments (No STK Push):**
For direct C2B payments where the user types in an Account Number (e.g., `INV-12345`), you can subscribe using that Account Number (`BillRefNumber`):

```javascript
const userAccountNumber = "INV-12345";
socket.emit('subscribe_to_payment', userAccountNumber);

socket.on('payment_status_update', (data) => {
    console.log(`Received C2B Payment from ${data.name} (${data.phone}) for amount ${data.amount}`);
});
```

### 4. Polling Fallback

If WebSockets are not an option for your external application, you can continuously poll the status endpoint until the status changes from `pending`:

**Endpoint:** `GET /api/stk/status/:checkout`

**Response (Success):**
```json
{
  "status": "success",
  "amount": 100,
  "receipt": "OEQ3XXX123",
  "message": "The service request is processed successfully.",
  "phone": "254712345678",
  "name": "John Doe",
  "accountReference": "INV-12345",
  "updatedAt": "2024-05-27T10:31:00.000Z"
}
```
