document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    const navPayments = document.getElementById('navPayments');
    const navApiKeys = document.getElementById('navApiKeys');
    const paymentsView = document.getElementById('paymentsView');
    const apiKeysView = document.getElementById('apiKeysView');

    const paymentsTableBody = document.getElementById('paymentsTableBody');
    const apiKeysTableBody = document.getElementById('apiKeysTableBody');

    const createKeyBtn = document.getElementById('createKeyBtn');
    const keyModal = document.getElementById('keyModal');
    const closeKeyModal = document.getElementById('closeKeyModal');
    const keyForm = document.getElementById('keyForm');

    // Navigation logic
    navPayments.addEventListener('click', () => {
        paymentsView.classList.remove('hidden');
        apiKeysView.classList.add('hidden');
        fetchPayments();
    });

    navApiKeys.addEventListener('click', () => {
        apiKeysView.classList.remove('hidden');
        paymentsView.classList.add('hidden');
        fetchApiKeys();
    });

    // Modal logic
    createKeyBtn.addEventListener('click', () => {
        keyModal.classList.remove('hidden');
    });

    closeKeyModal.addEventListener('click', () => {
        keyModal.classList.add('hidden');
    });

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
                if (res.status === 401 || res.status === 403) return handleAuthError();
                throw new Error('Failed to fetch payments');
            }

            const payments = await res.json();
            renderPaymentsTable(payments);
        } catch (error) {
            console.error(error);
        }
    }

    function renderPaymentsTable(payments) {
        paymentsTableBody.innerHTML = '';
        payments.forEach(payment => {
            const tr = document.createElement('tr');

            let statusColor = 'text-gray-500 bg-gray-100';
            if (payment.status === 'success' || payment.status === 'completed') statusColor = 'text-green-800 bg-green-100';
            if (payment.status === 'failed') statusColor = 'text-red-800 bg-red-100';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(payment.createdAt).toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="font-medium">${payment.name || 'N/A'}</div>
                    <div class="text-xs text-gray-400">${payment.merchant_request_id || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${payment.mpesa_receipt_number || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">KES ${payment.amount || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                        ${payment.status}
                    </span>
                </td>
            `;
            paymentsTableBody.appendChild(tr);
        });
    }

    // API Key Management Functions
    async function fetchApiKeys() {
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch('/api/admin/api-keys', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) return handleAuthError();
                throw new Error('Failed to fetch API keys');
            }

            const keys = await res.json();
            renderApiKeysTable(keys);
        } catch (error) {
            console.error(error);
        }
    }

    function renderApiKeysTable(keys) {
        apiKeysTableBody.innerHTML = '';
        keys.forEach(key => {
            const tr = document.createElement('tr');

            const lastUsed = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${key.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                   <div class="flex items-center space-x-2">
                      <span class="font-mono bg-gray-100 px-2 py-1 rounded select-all">${key.key}</span>
                      <button onclick="copyToClipboard('${key.key}')" class="text-blue-600 hover:text-blue-800 text-xs">Copy</button>
                   </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lastUsed}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button onclick="deleteApiKey('${key._id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            `;
            apiKeysTableBody.appendChild(tr);
        });
    }

    keyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('keyName').value;
        const token = localStorage.getItem('adminToken');

        try {
            const res = await fetch('/api/admin/api-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });

            if (res.ok) {
                keyModal.classList.add('hidden');
                keyForm.reset();
                fetchApiKeys();
            } else {
                alert('Failed to generate key');
            }
        } catch (error) {
            console.error(error);
        }
    });

    window.deleteApiKey = async (id) => {
        if (!confirm('Are you sure you want to delete this API Key?')) return;

        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`/api/admin/api-keys/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchApiKeys();
            } else {
                alert('Failed to delete key');
            }
        } catch (error) {
            console.error(error);
        }
    };

    window.copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    };

    function handleAuthError() {
        localStorage.removeItem('adminToken');
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    }
});
