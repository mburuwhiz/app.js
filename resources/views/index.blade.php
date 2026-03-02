<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WHIZPOINT SOLUTIONS - MPESA Payment</title>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f4f4f4; margin: 0; }
        .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 350px; }
        h2 { text-align: center; color: #333; margin-bottom: 20px; }
        .input-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #555; font-size: 14px; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 16px; }
        button { width: 100%; padding: 12px; background-color: #28a745; border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; transition: background 0.3s; }
        button:hover { background-color: #218838; }
        button:disabled { background-color: #ccc; cursor: not-allowed; }
        #status { margin-top: 20px; text-align: center; color: #666; font-size: 14px; min-height: 40px; }
        .logout-form { position: absolute; top: 20px; right: 20px; }
        .logout-btn { background: none; border: none; color: #007bff; cursor: pointer; font-size: 14px; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="logout-form">
        <form action="{{ route('logout') }}" method="POST">
            @csrf
            <button type="submit" class="logout-btn">Logout</button>
        </form>
    </div>

    <div class="container">
        <h2>Pay via MPESA</h2>
        <div class="input-group">
            <label for="amount">Amount (KES)</label>
            <input type="number" id="amount" placeholder="Amount" value="1" min="1">
        </div>
        <div class="input-group">
            <label for="phone">Phone Number</label>
            <input type="text" id="phone" placeholder="e.g. 0712345678">
        </div>
        <div class="input-group">
            <label for="reference">Reference</label>
            <input type="text" id="reference" placeholder="Reference" value="REF-{{ rand(1000, 9999) }}">
        </div>
        <button id="btnexpress" onclick="performstk()">Pay Now</button>
        <div id="status"></div>
    </div>

    <script>
        function performstk(){
            var amount = $('#amount').val();
            var phone  = $('#phone').val();
            var ref    = $('#reference').val();

            if(!amount || !phone || !ref) {
                alert("Please fill all fields");
                return;
            }

            $("#btnexpress").prop('disabled', true);
            $('#status').html("<span style='color: #007bff;'>Initiating STK Push...</span>");

            $.ajax({
                url: "/stk",
                type: "POST",
                data: {
                    _token: "{{ csrf_token() }}",
                    amount: amount,
                    phone: phone,
                    reference: ref
                },
                success: function(res){
                    if(res.success){
                        $('#status').html("<span style='color: #28a745;'>Check your phone and enter your MPESA PIN.</span>");
                        pollSTK(res.checkout, ref);
                    } else {
                        alert("STK Failed to initialize: " + (res.message || "Unknown error"));
                        $("#btnexpress").prop('disabled', false);
                        $('#status').text("");
                    }
                },
                error: function(xhr) {
                    var msg = "Server error. Please try again.";
                    if(xhr.responseJSON && xhr.responseJSON.errors) {
                        msg = Object.values(xhr.responseJSON.errors).flat().join("\n");
                    } else if(xhr.responseJSON && xhr.responseJSON.message) {
                        msg = xhr.responseJSON.message;
                    }
                    alert(msg);
                    $("#btnexpress").prop('disabled', false);
                    $('#status').text("");
                }
            });
        }

        function pollSTK(checkout, ref){
            let poll = setInterval(function(){
                $.get("/stk/status/" + checkout, function(statusRes){
                    if(statusRes.status === 'success'){
                        clearInterval(poll);
                        window.location.href = "/payment/success?ref=" + ref;
                    }

                    if(statusRes.status === 'failed'){
                        clearInterval(poll);
                        window.location.href = "/payment/failed?ref=" + ref;
                    }
                });
            }, 3000);
        }
    </script>
</body>
</html>
