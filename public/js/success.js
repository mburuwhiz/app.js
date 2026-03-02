document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutId = urlParams.get('checkout');

    if (!checkoutId) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`/api/stk/status/${checkoutId}`);
        const data = await response.json();

        if (data.status === 'success') {
            document.getElementById('customerName').innerText = data.name || 'N/A';
            document.getElementById('receiptNumber').innerText = data.receipt;
            document.getElementById('amountPaid').innerText = data.amount;
            document.getElementById('refCode').innerText = data.accountReference || 'N/A';
            document.getElementById('phoneNo').innerText = data.phone || 'N/A';
            document.getElementById('timestamp').innerText = new Date(data.updatedAt).toLocaleString();
        } else {
            document.body.innerHTML = '<div class="text-center mt-20 p-8 text-red-600 bg-red-100 rounded-lg shadow-md max-w-md mx-auto"><h2>Payment not successful or pending.</h2><a href="/" class="mt-4 inline-block text-blue-500 underline">Return Home</a></div>';
        }
    } catch (error) {
        console.error('Error fetching details:', error);
    }
});