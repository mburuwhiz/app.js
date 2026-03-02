# MPESA STK Push Integration (Laravel) – Complete Production Guide

A complete, battle-tested implementation of **Safaricom MPESA STK Push** in a Laravel application.

Integrating MPESA STK Push can be confusing — tokens, callbacks, strange errors, routes not firing, and unclear documentation.

This guide documents the **exact step-by-step process** used to implement a fully working STK Push pipeline, including:

* Initiating STK Push
* Receiving the callback
* Polling payment status
* Redirecting user after payment
* Preventing double payment
* Handling Business Central payments
* Debug logging

If you're stuck on MPESA integration, this is the guide you wish you had.

---

# 📌 Preconditions

Before starting, ensure:

1. You have an approved Business Shortcode (Paybill/Till).
2. You have:

   * Consumer Key
   * Consumer Secret
   * Passkey
3. Your callback URL is publicly accessible via HTTPS.

If not, obtain credentials from the Safaricom Developer Portal.

---

# ⚙️ 1. Environment Setup

## config/app.php

```php
'passkey' => env('PASSKEY'),
'token'   => env('TOKEN_CREDENTIALS'),
```

## .env

```env
PASSKEY=your_mpesa_passkey_here
TOKEN_CREDENTIALS=consumer_key:consumer_secret
```

## Accessing in Laravel

```php
$passkey = config('app.passkey');
```

If you get `null`:

* Ensure `.env` has no extra spaces
* Run:

```bash
php artisan config:clear
```

---

# 🚀 2. STK Push Route

A simple route to trigger the STK Push:

```php
Route::get('/stk/{amount}/{phone}/{appno}', [GeneralController::class, 'stk']);
```

Triggered via AJAX from frontend.

---

# 💳 3. STK Push Controller Logic

```php
public function stk($amount, $phoneno, $appno)
{
    $normalized = preg_replace('/^0/', '254', $phoneno);
    $token = $this->token();

    $url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    $payload = [
        'BusinessShortCode' => "632333",
        'Password' => base64_encode("632333" . config('app.passkey') . date('YmdHis')),
        'Timestamp' => date('YmdHis'),
        'TransactionType' => 'CustomerPayBillOnline',
        'Amount' => $amount,
        'PartyA' => $phoneno,
        'PartyB' => "632333",
        'PhoneNumber' => $normalized,
        'CallBackURL' => 'https://application.spu.ac.ke/api/mpesa/callback',
        'AccountReference' => $appno,
        'TransactionDesc' => $appno,
    ];

    $curl = curl_init();

    curl_setopt_array($curl, [
        CURLOPT_URL => $url,
        CURLOPT_HTTPHEADER => [
            'Content-Type:application/json',
            "Authorization:Bearer $token"
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    Log::info("STK Push Request Sent");

    $response = curl_exec($curl);
    $decoded = json_decode($response, true);

    return response()->json([
        'success' => true,
        'checkout' => $decoded['CheckoutRequestID'] ?? null,
        'response' => $decoded
    ]);
}
```

This returns the `CheckoutRequestID` for frontend polling.

---

# 🔐 4. Token Generator

```php
public function token()
{
    $url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    $credentials = base64_encode(config('app.token'));

    $curl = curl_init();

    curl_setopt_array($curl, [
        CURLOPT_URL => $url,
        CURLOPT_HTTPHEADER => ["Authorization: Basic $credentials"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    $response = curl_exec($curl);
    $parts = explode('"access_token":"', $response);

    return strtok($parts[1], '"');
}
```

Generates OAuth token required for STK requests.

---

# 🔔 5. Handling the MPESA Callback

## Route (routes/api.php)

```php
Route::post('/mpesa/callback', [GeneralController::class, 'stkCallback']);
```

## Controller

```php
public function stkCallback(Request $request)
{
    Log::info('MPESA Callback Received:');
    Log::info($request->getContent());

    $data = json_decode($request->getContent(), true);
    $callback = $data['Body']['stkCallback'];
    $checkout = $callback['CheckoutRequestID'];
    $resultCode = $callback['ResultCode'];

    if ($resultCode == 0) {

        $metadata = collect($callback['CallbackMetadata']['Item']);

        cache()->put("stk_status_$checkout", [
            'status' => 'success',
            'amount' => $metadata->where('Name', 'Amount')->first()['Value'] ?? null,
            'code' => $metadata->where('Name', 'MpesaReceiptNumber')->first()['Value'] ?? null,
            'phone' => $metadata->where('Name', 'PhoneNumber')->first()['Value'] ?? null,
            'timestamp' => now()
        ], now()->addMinutes(10));

    } else {

        cache()->put("stk_status_$checkout", [
            'status' => 'failed'
        ], now()->addMinutes(10));
    }

    return response()->json(['ResultCode' => 0]);
}
```

Stores temporary status in cache for frontend polling.

---

# 🌐 6. Frontend STK Trigger (AJAX)

```javascript
function performstk(){
    $("#btnexpress").prop('disabled', true);

    var amount = $('#amount').val();
    var phone  = $('#phone').val();
    var appno  = $('#appno').val();

    $.get("/stk/" + amount + "/" + phone + "/" + appno, function(res){
        console.log("Checkout ID:", res.checkout);
        pollSTK(res.checkout, appno, amount, phone);
    });
}
```

---

# 🔄 7. Polling Payment Status

## Route

```php
Route::get('/stk/status/{checkout}', [GeneralController::class, 'checkStkStatus']);
```

## Controller

```php
public function checkStkStatus($checkout)
{
    return cache()->get("stk_status_$checkout", ['status' => 'pending']);
}
```

## Frontend Poller

```javascript
function pollSTK(checkout, appno, amount, phone){

    let poll = setInterval(function(){

        $.get("/stk/status/" + checkout, function(statusRes){

            if(statusRes.status === 'success'){
                clearInterval(poll);
                window.location.href = "/payment/success?appno=" + appno;
            }

            if(statusRes.status === 'failed'){
                clearInterval(poll);
                window.location.href = "/payment/failed?appno=" + appno;
            }

        });

    }, 3000);
}
```

---

# ✅ 8. Success & Failed Routes

```php
Route::get('/payment/success', [GeneralController::class, 'paymentSuccess']);
Route::get('/payment/failed', [GeneralController::class, 'paymentFailed']);
```

## Controller

```php
public function paymentSuccess()
{
    return redirect()->back()->with('success', 'Payment successfully made!');
}

public function paymentFailed()
{
    return redirect()->back()->with('error', 'Payment failed, try again.');
}
```

---

# 🔒 9. Preventing Double Payment

After successful payment:

* Mark payment as completed in database
* Or validate against Business Central

## Example

```php
$hasPaid = $paymentStatusFromBC === true;

if ($hasPaid) {
    $application_fees = 0;
}
```

## Blade Example

```blade
@if($applicationFees == 0)
    <div class="alert alert-success">Payment already completed</div>
@else
    <a href="#paymentmodal" class="btn btn-success open-paymentmodal"
       data-phone="{{ $application['TelNo_1'] }}"
       data-id="{{ $application['Applicant_Id_Number'] }}"
       data-amount="{{ $applicationFees }}">
       Make Payment via MPESA
    </a>
@endif
```

---

# 🏁 Final Result

By the end of this implementation, we achieved:

✔ Working STK Push initiation
✔ Successful callback reception
✔ Frontend polling mechanism
✔ Automatic success/failure redirect
✔ Prevention of repeated payments
✔ Business Central integration
✔ Fully logged payment lifecycle

---

# 🎯 Summary

This is a complete, production-ready MPESA STK Push pipeline built in Laravel.

It covers:

* OAuth token generation
* STK push request
* Callback handling
* Status polling
* UI redirection
* Duplicate payment prevention


