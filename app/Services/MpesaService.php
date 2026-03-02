<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class MpesaService
{
    protected $shortcode;
    protected $till;
    protected $passkey;
    protected $token;
    protected $callback;

    public function __construct()
    {
        $this->shortcode = config('app.shortcode');
        $this->till = config('app.till');
        $this->passkey = config('app.passkey');
        $this->token = config('app.token');
        $this->callback = config('app.callback');
    }

    public function generateToken()
    {
        $url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
        $credentials = base64_encode($this->token);

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_HTTPHEADER => [
                "Authorization: Basic $credentials"
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true // Enabled for production
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);
        curl_close($curl);

        if ($err) {
            Log::error("Mpesa Token Generation cURL Error: " . $err);
            return null;
        }

        $decoded = json_decode($response);
        if (!isset($decoded->access_token)) {
            Log::error("Mpesa Token Generation Failed", [$response]);
            return null;
        }

        return $decoded->access_token;
    }

    public function initiateStkPush($amount, $phone, $reference)
    {
        $accessToken = $this->generateToken();
        if (!$accessToken) return null;

        $timestamp = date('YmdHis');
        $password = base64_encode($this->shortcode . $this->passkey . $timestamp);

        $url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

        $payload = [
            'BusinessShortCode' => $this->shortcode,
            'Password' => $password,
            'Timestamp' => $timestamp,
            'TransactionType' => 'CustomerBuyGoodsOnline',
            'Amount' => (int)$amount,
            'PartyA' => $phone,
            'PartyB' => $this->till,
            'PhoneNumber' => $phone,
            'CallBackURL' => $this->callback,
            'AccountReference' => $reference,
            'TransactionDesc' => 'Payment to WHIZPOINT SOLUTIONS'
        ];

        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_HTTPHEADER => [
                'Content-Type:application/json',
                "Authorization:Bearer $accessToken"
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_SSL_VERIFYPEER => true // Enabled for production
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);
        curl_close($curl);

        if ($err) {
            Log::error("Mpesa STK Push cURL Error: " . $err);
            return ['error' => 'cURL error: ' . $err];
        }

        return json_decode($response, true);
    }
}
