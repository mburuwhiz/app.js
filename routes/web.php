<?php

use App\Http\Controllers\GeneralController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('index');
})->middleware('auth');

Route::post('/stk', [GeneralController::class, 'stk'])->middleware('auth');
Route::post('/callback', [GeneralController::class, 'stkCallback']);
Route::get('/stk/status/{checkout}', [GeneralController::class, 'checkStkStatus'])->middleware('auth');

Route::get('/payment/success', function () {
    return view('success');
})->name('payment.success')->middleware('auth');

Route::get('/payment/failed', function () {
    return view('failed');
})->name('payment.failed')->middleware('auth');

Route::get('/login', function () {
    return view('login');
})->name('login');

Route::post('/login', function (\Illuminate\Http\Request $request) {
    $credentials = $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required'],
    ]);

    if (\Illuminate\Support\Facades\Auth::attempt($credentials)) {
        $request->session()->regenerate();
        return redirect()->intended('/');
    }

    return back()->withErrors([
        'email' => 'The provided credentials do not match our records.',
    ])->onlyInput('email');
});

Route::post('/logout', function (\Illuminate\Http\Request $request) {
    \Illuminate\Support\Facades\Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();
    return redirect('/login');
})->name('logout');

Route::fallback(function () {
    return response()->view('errors.404', [], 404);
});
