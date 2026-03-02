Integrating MPESA STK Push can be confusing — callbacks, tokens, parameters, weird errors from Safaricom, and routes that simply don’t fire.

In this article, I document the exact step-by-step process I followed to implement a fully functional MPESA STK Push flow in my Laravel application — including:

Initiating STK push
Receiving the callback
Polling payment status
Redirecting user after payment
Preventing double-payment
Handling Business Central payments
Fixing common STK issues

If you’re stuck on MPESA integration, this is the guide you wish you had.

Preconditions
1. You have applied for your Business number
2. You have all the required keys, if not , get them from your developer portal or contact Safaricom for more information.

1. Environment Setup
In config/app.php:

'passkey' => env('PASSKEY'),
'token' => env('TOKEN_CREDENTIALS'),
In .env:

PASSKEY=your_mpesa_passkey_here
TOKEN_CREDENTIALS=consumer_key:consumer_secret
Accessing:

$passkey = config('app.passkey');
If you get null, remember:
→ .env must not contain spaces
→ run php artisan config:clear

2. STK Push Route
We used a simple GET route for triggering the payment:

Route::get('/stk/{amount}/{phone}/{appno}', [GeneralController::class, 'stk']);
This is triggered from the frontend using AJAX.

3. STK Push Controller Logic
Here is the final STK function:

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
    // Return checkoutRequestID for polling
    return response()->json([
        'success' => true,
        'checkout' => $decoded['CheckoutRequestID'] ?? null,
        'response' => $decoded
    ]);
}
4. Token Generator
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
5. Handling the MPESA Callback
Route in routes/api.php:

Route::post('/mpesa/callback', [GeneralController::class, 'stkCallback']);
Callback controller:

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
This creates a temporary payment status in cache for the frontend to poll.

6. Frontend STK Trigger (AJAX)
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
7. Polling the Payment Status
Route:

Route::get('/stk/status/{checkout}', [GeneralController::class, 'checkStkStatus']);
Controller:

public function checkStkStatus($checkout)
{
    return cache()->get("stk_status_$checkout", ['status' => 'pending']);
}
Frontend poller:

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
8. Success & Failed Routes
Route::get('/payment/success', [GeneralController::class, 'paymentSuccess']);
Route::get('/payment/failed', [GeneralController::class, 'paymentFailed']);
Controller methods:

public function paymentSuccess()
{
    return redirect()->back()->with('success', 'Payment successfully made!');
}
public function paymentFailed()
{
    return redirect()->back()->with('error', 'Payment failed, try again.');
}
9. Preventing Double Payment
Once a payment is successful, mark it in the database or Business Central.

Get Peter Ochieng’s stories in your inbox
Join Medium for free to get updates from this writer.

Enter your email
Subscribe
Example in BC response fetch:

$hasPaid = $paymentStatusFromBC === true;
if ($hasPaid) {
    $application_fees = 0;
}
In Blade:

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
Final Result
By the end of this process, we had:

✔ A working STK push
✔ A callback successfully received
✔ A polling system to detect success
✔ Redirection after payment
✔ Prevention of repeated payments
✔ Integration with Business Central data
✔ Fully logged flow for debugging

This is a battle-tested, production-ready MPESA STK Push pipeline.



