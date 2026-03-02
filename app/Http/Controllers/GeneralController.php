<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\MpesaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;

class GeneralController extends Controller
{
    protected $mpesaService;

    public function __construct(MpesaService $mpesaService)
    {
        $this->mpesaService = $mpesaService;
    }

    public function stk(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:1',
            'phone' => ['required', 'regex:/^(?:254|\+254|0)?(7|1)\d{8}$/'],
            'reference' => 'required|string|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $amount = $request->amount;
        $phoneno = $request->phone;
        $reference = $request->reference;

        $normalized = preg_replace('/^(?:\+254|0)/', '254', $phoneno);
        if (strlen($normalized) == 9) {
            $normalized = '254' . $normalized;
        }

        Log::info("Initiating STK Push for $normalized, Amount: $amount");

        $decoded = $this->mpesaService->initiateStkPush($amount, $normalized, $reference);

        if (!$decoded || !isset($decoded['CheckoutRequestID'])) {
            return response()->json([
                'success' => false,
                'message' => 'STK Push failed to initialize',
                'error' => $decoded
            ], 400);
        }

        // Store initial payment record
        Payment::create([
            'amount' => $amount,
            'phone' => $normalized,
            'status' => 'pending',
            'checkout_request_id' => $decoded['CheckoutRequestID'],
            'reference' => $reference,
        ]);

        return response()->json([
            'success' => true,
            'checkout' => $decoded['CheckoutRequestID']
        ]);
    }

    public function stkCallback(Request $request)
    {
        Log::info('WHIZPOINT CALLBACK RECEIVED');
        $content = $request->getContent();
        Log::info($content);

        $data = json_decode($content, true);

        if (!isset($data['Body']['stkCallback'])) {
            Log::error("Invalid Callback Structure");
            return response()->json(['ResultCode' => 0]);
        }

        $callback = $data['Body']['stkCallback'];
        $checkout = $callback['CheckoutRequestID'];
        $resultCode = $callback['ResultCode'];

        if ($resultCode == 0) {
            $metadata = collect($callback['CallbackMetadata']['Item']);

            $amount  = $metadata->where('Name','Amount')->first()['Value'] ?? null;
            $receipt = $metadata->where('Name','MpesaReceiptNumber')->first()['Value'] ?? null;
            $phone   = $metadata->where('Name','PhoneNumber')->first()['Value'] ?? null;

            Cache::put("stk_status_$checkout", [
                'status' => 'success',
                'amount' => $amount,
                'receipt' => $receipt,
                'phone' => $phone,
                'timestamp' => now()
            ], now()->addMinutes(15));

            Log::info("PAYMENT SUCCESS: $receipt");

            // Idempotency check and update
            if ($receipt && !Payment::where('receipt', $receipt)->exists()) {
                $payment = Payment::where('checkout_request_id', $checkout)->first();
                if ($payment) {
                    $payment->update([
                        'receipt' => $receipt,
                        'status' => 'completed',
                        'amount' => $amount,
                        'phone' => $phone,
                    ]);
                } else {
                    Payment::create([
                        'receipt' => $receipt,
                        'amount'  => $amount,
                        'phone'   => $phone,
                        'status'  => 'completed',
                        'checkout_request_id' => $checkout,
                    ]);
                }
            }
        } else {
            Cache::put("stk_status_$checkout", [
                'status' => 'failed'
            ], now()->addMinutes(15));

            Log::warning("PAYMENT FAILED: $checkout, ResultCode: $resultCode");

            $payment = Payment::where('checkout_request_id', $checkout)->first();
            if ($payment) {
                $payment->update(['status' => 'failed']);
            }
        }

        return response()->json(['ResultCode' => 0]);
    }

    public function checkStkStatus($checkout)
    {
        return Cache::get("stk_status_$checkout", [
            'status' => 'pending'
        ]);
    }
}
