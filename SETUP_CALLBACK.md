# Setting up Local Callbacks for M-Pesa

When developing an application that uses the M-Pesa API, you need a way for Safaricom's servers to reach your local application to send payment status updates (callbacks).

Because your local development server (e.g., `http://localhost:3000`) is typically only accessible from your own computer, you need to expose it to the internet. This is a common requirement when developing applications for mobile phones as well.

This guide will show you how to use a tool called **ngrok** to create a secure tunnel to your local machine.

## Prerequisites
1.  **Node.js** installed on your machine.
2.  Your M-Pesa application running locally (e.g., running `node src/server.js`).

## Step 1: Install ngrok

Ngrok is a powerful tool that creates a secure URL to your localhost server.

1.  **Download ngrok:** Go to the official ngrok website ([https://ngrok.com/download](https://ngrok.com/download)) and download the appropriate version for your operating system.
2.  **Unzip the downloaded file.**
3.  **Create an account:** Sign up for a free account at [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup).
4.  **Connect your account:** Once logged in, you will find an "authtoken" on your ngrok dashboard. Open your terminal or command prompt and run the following command to authenticate your ngrok client:

    ```bash
    ngrok config add-authtoken <your-authtoken>
    ```
    *Replace `<your-authtoken>` with the actual token from your dashboard.*

## Step 2: Start your Local Application

Make sure your Node.js application is running. By default, this application likely runs on port `3000` (check your `.env` file or `server.js` if it's different).

```bash
# Start your local server
node src/server.js
```

## Step 3: Start the ngrok Tunnel

Open a **new** terminal window (keep your Node.js app running in the first one) and run the following command to start ngrok on the same port your app is using (e.g., `3000`):

```bash
ngrok http 3000
```

Ngrok will start and display a screen in your terminal that looks something like this:

```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://a1b2c3d4e5f6.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

The important part is the **Forwarding** URL. In this example, it is `https://a1b2c3d4e5f6.ngrok-free.app`.

**Important:** Keep this terminal window open as long as you need to receive callbacks. Every time you restart ngrok on the free plan, you will get a *new* forwarding URL.

## Step 4: Configure your Application

Now that you have a public URL, you need to tell your application to use it when talking to M-Pesa.

1.  Open your `.env` file.
2.  Find the `CALLBACK_URL` variable.
3.  Update it to use your ngrok forwarding URL, appending `/api/mpesa/callback` to it.

For example, if your ngrok URL is `https://a1b2c3d4e5f6.ngrok-free.app`, your `.env` file should look like this:

```env
CALLBACK_URL=https://a1b2c3d4e5f6.ngrok-free.app/api/mpesa/callback
```

**Restart your Node.js application** for the `.env` changes to take effect.

## Step 5: Test the Callback

Now, when you initiate an M-Pesa STK push from your local application (e.g., `http://localhost:3000`), the `CALLBACK_URL` sent to Safaricom will be your ngrok URL.

When the user completes or cancels the payment on their phone, Safaricom will send an HTTP POST request to `https://a1b2c3d4e5f6.ngrok-free.app/api/mpesa/callback`.

Ngrok will receive this request and immediately forward it to your local application running at `http://localhost:3000/api/mpesa/callback`.

You should see the callback payload logged in the terminal where your Node.js application is running!

## Developing for Mobile Phones

If you are developing a mobile app (e.g., React Native, Flutter) and want it to talk to your local backend, you cannot use `localhost` or `127.0.0.1` in your mobile app code, because the mobile phone (or emulator) considers *itself* to be localhost.

Instead, you can use the same ngrok URL!

In your mobile app code, set your API base URL to your ngrok URL. For example:

```javascript
// Inside your mobile app code
const API_BASE_URL = 'https://a1b2c3d4e5f6.ngrok-free.app/api';

// Example API call to initiate STK push
fetch(`${API_BASE_URL}/stk`, { ... });
```

This allows your mobile app to communicate directly with the local server running on your computer.
