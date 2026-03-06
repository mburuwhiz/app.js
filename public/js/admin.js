document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const paymentsTableBody = document.getElementById('paymentsTableBody');

    // Check if user is already logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
        showDashboard();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('adminToken', data.token);
                showDashboard();
            } else {
                loginError.textContent = data.error || 'Login failed';
                loginError.classList.remove('hidden');
            }
        } catch (error) {
            loginError.textContent = 'Server error during login.';
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    });

    async function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        fetchPayments();
    }

    async function fetchPayments() {
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch('/api/admin/payments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem('adminToken');
                    loginSection.classList.remove('hidden');
                    dashboardSection.classList.add('hidden');
                    return;
                }
                throw new Error('Failed to fetch payments');
            }

            const payments = await res.json();
            renderTable(payments);
        } catch (error) {
            console.error(error);
        }
    }

    function renderTable(payments) {
        paymentsTableBody.innerHTML = '';
        payments.forEach(payment => {
            const tr = document.createElement('tr');

            let statusColor = 'text-gray-500 bg-gray-100';
            if (payment.status === 'success') statusColor = 'text-green-800 bg-green-100';
            if (payment.status === 'failed') statusColor = 'text-red-800 bg-red-100';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(payment.createdAt).toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${payment.name || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${payment.mpesa_receipt_number || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">KES ${payment.amount || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                        ${payment.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.merchant_request_id || 'N/A'}</td>
            `;
            paymentsTableBody.appendChild(tr);
        });
    }
});