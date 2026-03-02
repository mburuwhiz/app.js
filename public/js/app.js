document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('paymentForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusContainer = document.getElementById('statusContainer');
    const resultContainer = document.getElementById('resultContainer');
    const statusMessage = document.getElementById('statusMessage');
    const resultMessage = document.getElementById('resultMessage');
    const receiptNumber = document.getElementById('receiptNumber');
    const resetBtn = document.getElementById('resetBtn');

    let pollInterval;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const phone = document.getElementById('phone').value;
        const amount = document.getElementById('amount').value;
        const accountReference = document.getElementById('accountReference').value;

        submitBtn.disabled = true;
        submitBtn.innerText = 'Processing...';
        statusContainer.classList.remove('hidden');

        try {
            // Fetch API key securely instead of hardcoding it in the frontend JS
            // In a production scenario with user accounts, this would be a JWT token after login
            const configResponse = await fetch('/api/config');
            const configData = await configResponse.json();
            const apiKey = configData.apiKey;

            const response = await fetch('/api/stk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify({ phone, amount, accountReference })
            });

            const data = await response.json();

            if (data.success) {
                pollPaymentStatus(data.checkout);
            } else {
                showError('Failed to initiate payment: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            showError('Network error. Please try again.');
        }
    });

    const pollPaymentStatus = (checkoutRequestId) => {
        statusMessage.innerText = 'Waiting for you to enter PIN on your phone...';

        pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/stk/status/${checkoutRequestId}`);
                const data = await response.json();

                if (data.status === 'success') {
                    clearInterval(pollInterval);
                    showSuccess(`Payment successful!`, data.receipt);
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    showError(data.message || 'Payment failed or cancelled.');
                }
                // If 'pending', continue polling
            } catch (error) {
                console.error('Polling error', error);
            }
        }, 5000); // Poll every 5 seconds
    };

    const showSuccess = (msg, receipt) => {
        form.classList.add('hidden');
        statusContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

        resultContainer.classList.add('bg-green-100', 'border-green-400');
        resultMessage.classList.add('text-green-700');
        resultMessage.innerText = msg;

        if (receipt) {
            receiptNumber.classList.remove('hidden');
            receiptNumber.innerText = `Receipt: ${receipt}`;
            receiptNumber.classList.add('text-green-800');
        }
    };

    const showError = (msg) => {
        form.classList.add('hidden');
        statusContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');

        resultContainer.classList.add('bg-red-100', 'border-red-400');
        resultMessage.classList.add('text-red-700');
        resultMessage.innerText = msg;
        receiptNumber.classList.add('hidden');
    };

    resetBtn.addEventListener('click', () => {
        form.reset();
        form.classList.remove('hidden');
        resultContainer.classList.add('hidden');

        // Reset styles
        resultContainer.className = 'hidden mt-6 p-4 rounded-md border';
        resultMessage.className = 'text-sm font-medium text-center';

        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay Now';
    });
});
