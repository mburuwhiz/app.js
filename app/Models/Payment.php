<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'receipt',
        'amount',
        'phone',
        'status',
        'checkout_request_id',
        'reference',
    ];
}
