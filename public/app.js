/* ============================================
   INSTALLMENT TRACKER - Frontend Application
   ============================================ */

const API_BASE = '';
let allCustomers = [];
let expandedCards = new Set();
let confirmCallback = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadCustomers();
});

// ============================================
// API HELPERS
// ============================================

async function api(url, options = {}) {
    showLoading();
    try {
        const response = await fetch(`${API_BASE}${url}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

// ============================================
// LOAD & RENDER
// ============================================

async function loadCustomers() {
    try {
        allCustomers = await api('/api/customers');
        renderDashboard();
        renderCustomers();
    } catch (error) {
        console.error('Failed to load customers:', error);
    }
}

function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekStr = weekFromNow.toISOString().split('T')[0];

    const total = allCustomers.length;
    const cash = allCustomers.filter(c => c.terms === 0).length;
    const installment = allCustomers.filter(c => c.terms > 0).length;
    const outstanding = allCustomers.reduce((sum, c) => sum + c.balance, 0);
    const dueSoon = allCustomers.filter(c =>
        c.status !== 'PAID' && c.next_due_date >= today && c.next_due_date <= weekStr
    ).length;
    const overdue = allCustomers.filter(c =>
        c.status !== 'PAID' && c.next_due_date < today
    ).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-cash').textContent = cash;
    document.getElementById('stat-installment').textContent = installment;
    document.getElementById('stat-balance').textContent = formatCurrency(outstanding);
    document.getElementById('stat-due').textContent = dueSoon;
    document.getElementById('stat-overdue').textContent = overdue;
}

function renderCustomers() {
    const container = document.getElementById('customer-list');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const sortBy = document.getElementById('sort-select').value;

    let filtered = allCustomers.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.brand.toLowerCase().includes(searchTerm) ||
        c.model.toLowerCase().includes(searchTerm)
    );

    filtered = sortCustomerList(filtered, sortBy);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No customers found</h3>
                <p>Add your first customer to get started.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pageItems.map(customer => createCustomerCard(customer)).join('') +
        createPagination(filtered.length, totalPages);
}

function createPagination(total, totalPages) {
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';

    html += `<button class="btn btn-small btn-secondary" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>Prev</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="btn btn-small btn-primary">${i}</button>`;
        } else if (
            i === 1 ||
            i === totalPages ||
            (i >= currentPage - 2 && i <= currentPage + 2)
        ) {
            html += `<button class="btn btn-small btn-secondary" onclick="goPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="pagination-dots">...</span>`;
        }
    }

    html += `<button class="btn btn-small btn-secondary" onclick="goPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>`;

    html += `<span class="pagination-info">${total} total</span>`;
    html += '</div>';
    return html;
}

function goPage(page) {
    currentPage = page;
    renderCustomers();
}

function createCustomerCard(customer) {
    const isExpanded = expandedCards.has(customer.id);
    const status = getDisplayStatus(customer);
    const totalPaid = customer.total_amount - customer.balance;

    return `
        <div class="customer-card ${isExpanded ? 'expanded' : ''}" id="card-${customer.id}">
            <div class="customer-card-header" onclick="toggleCard(${customer.id})">
                <div class="customer-info">
                    <span class="customer-name">${escapeHtml(customer.name)}</span>
                    <span class="customer-model">${escapeHtml(customer.brand)} ${escapeHtml(customer.model)}</span>
                </div>
                <div class="customer-meta">
                    <span class="customer-balance">${formatCurrency(customer.balance)}</span>
                    <span class="customer-due">Due: ${formatDate(customer.next_due_date)}</span>
                    <span class="badge ${status.class}">${status.label}</span>
                </div>
            </div>
            <div class="customer-card-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Address</span>
                        <span class="detail-value">${escapeHtml(customer.address) || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Serial Number</span>
                        <span class="detail-value">${escapeHtml(customer.serial_number) || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Purchase Date</span>
                        <span class="detail-value">${formatDate(customer.purchase_date) || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">SRP</span>
                        <span class="detail-value">${formatCurrency(customer.srp)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Down Payment</span>
                        <span class="detail-value">${formatCurrency(customer.downpayment)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Terms</span>
                        <span class="detail-value">${customer.terms} months</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Monthly Installment</span>
                        <span class="detail-value">${customer.balance === 0 && customer.terms === 0 ? '— (Cash)' : formatCurrency(customer.monthly_installment)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Amount</span>
                        <span class="detail-value">${formatCurrency(customer.total_amount)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Paid</span>
                        <span class="detail-value">${formatCurrency(totalPaid)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Balance</span>
                        <span class="detail-value" style="color: var(--blue-dark); font-weight: 700;">${formatCurrency(customer.balance)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    ${customer.status !== 'PAID' ? `<button onclick="openPaymentModal(${customer.id})" class="btn btn-primary btn-small">+ Payment</button>` : ''}
                    <button onclick="openEditCustomerModal(${customer.id})" class="btn btn-secondary btn-small">Edit</button>
                    <button onclick="printLedger(${customer.id})" class="btn btn-gold btn-small">Print</button>
                    <button onclick="confirmDelete(${customer.id}, '${escapeHtml(customer.name)}')" class="btn btn-danger btn-small">Delete</button>
                </div>
                <div class="payment-history" id="payments-${customer.id}">
                    <h4>Payment History</h4>
                    <p style="color: var(--text-muted); font-size: 0.8rem;">Loading...</p>
                </div>
            </div>
        </div>
    `;
}

async function loadPaymentHistory(customerId) {
    try {
        const payments = await api(`/api/payments/${customerId}`);
        const container = document.getElementById(`payments-${customerId}`);
        if (!container) return;

        const customer = allCustomers.find(c => c.id === customerId);
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalRebate = payments.reduce((sum, p) => sum + (p.rebate || 0), 0);

        if (payments.length === 0) {
            container.innerHTML = `
                <h4>Payment History</h4>
                <p style="color: var(--text-muted); font-size: 0.8rem;">No payments yet.</p>
            `;
            return;
        }

        container.innerHTML = `
            <h4>Payment History</h4>
            <div class="payment-table-wrapper">
            <table class="payment-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Rebate</th>
                        <th>Net</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => `
                        <tr>
                            <td>${formatDate(p.payment_date)}</td>
                            <td>${formatCurrency(p.amount)}</td>
                            <td>${p.rebate > 0 ? formatCurrency(p.rebate) : '—'}</td>
                            <td>${formatCurrency(p.amount - (p.rebate || 0))}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-paid-row">
                        <td colspan="2"><strong>Total Paid</strong></td>
                        <td>${totalRebate > 0 ? formatCurrency(totalRebate) : '—'}</td>
                        <td><strong>${formatCurrency(totalPaid)}</strong></td>
                    </tr>
                </tbody>
            </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load payments:', error);
    }
}

// ============================================
// CARD TOGGLE
// ============================================

function toggleCard(customerId) {
    const card = document.getElementById(`card-${customerId}`);
    if (card.classList.contains('expanded')) {
        card.classList.remove('expanded');
        expandedCards.delete(customerId);
    } else {
        card.classList.add('expanded');
        expandedCards.add(customerId);
        loadPaymentHistory(customerId);
    }
}

// ============================================
// CUSTOMER CRUD MODALS
// ============================================

function openAddCustomerModal() {
    const today = new Date().toISOString().split('T')[0];
    openModal(`
        <div class="modal-header">
            <h2>Add Customer</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="customer-form" onsubmit="addCustomer(event)">
            <div class="form-group" style="margin-bottom: 1.25rem;">
                <label class="cash-toggle">
                    <input type="checkbox" id="cash-mode" onchange="toggleCashMode()">
                    <span class="cash-toggle-label">Cash Payment (one-time)</span>
                </label>
            </div>
            <div class="form-group">
                <label for="name">Name *</label>
                <input type="text" id="name" required>
            </div>
            <div id="installment-fields">
                <div class="form-group">
                    <label for="address">Address</label>
                    <input type="text" id="address">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="brand">Brand</label>
                        <input type="text" id="brand">
                    </div>
                    <div class="form-group">
                        <label for="model">Model</label>
                        <input type="text" id="model">
                    </div>
                </div>
                <div class="form-group">
                    <label for="serial_number">Serial Number</label>
                    <input type="text" id="serial_number">
                </div>
                <div class="form-group">
                    <label for="purchase_date">Purchase Date</label>
                    <input type="date" id="purchase_date" value="${today}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="downpayment">Down Payment (₱)</label>
                        <input type="number" id="downpayment" min="0" step="0.01" value="0" oninput="previewInstallment()">
                    </div>
                    <div class="form-group">
                        <label for="terms">Terms (months)</label>
                        <input type="number" id="terms" min="1" value="12" oninput="previewInstallment()">
                    </div>
                </div>
                <div class="form-group">
                    <label>Monthly Installment</label>
                    <input type="text" id="monthly-preview" readonly style="background: var(--bg-cream); font-weight: 700;">
                </div>
            </div>
            <div class="form-group">
                <label for="srp">SRP (₱)</label>
                <input type="number" id="srp" min="0" step="0.01" value="0" oninput="previewInstallment()" required>
            </div>
            <div id="cash-info" class="cash-info hidden">
                <span class="cash-info-icon">&#10003;</span> PAID IN FULL — Cash customer
            </div>
            <div class="modal-actions">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Customer</button>
            </div>
        </form>
    `);
    previewInstallment();
}

function toggleCashMode() {
    const isCash = document.getElementById('cash-mode').checked;
    const fields = document.getElementById('installment-fields');
    const cashInfo = document.getElementById('cash-info');
    const srpInput = document.getElementById('srp');

    if (isCash) {
        fields.style.display = 'none';
        cashInfo.classList.remove('hidden');
        srpInput.required = true;
    } else {
        fields.style.display = '';
        cashInfo.classList.add('hidden');
    }
    previewInstallment();
}

function previewInstallment() {
    const isCash = document.getElementById('cash-mode')?.checked;
    const srp = parseFloat(document.getElementById('srp')?.value) || 0;
    const preview = document.getElementById('monthly-preview');

    if (isCash) {
        if (preview) preview.value = 'PAID IN FULL';
        return;
    }

    const dp = parseFloat(document.getElementById('downpayment')?.value) || 0;
    const terms = parseInt(document.getElementById('terms')?.value) || 1;
    const balance = srp - dp;
    const monthly = terms > 0 ? balance / terms : 0;
    if (preview) preview.value = formatCurrency(monthly);
}

async function addCustomer(event) {
    event.preventDefault();
    const isCash = document.getElementById('cash-mode').checked;
    const srp = parseFloat(document.getElementById('srp').value) || 0;

    let payload = {
        name: document.getElementById('name').value,
        srp: srp
    };

    if (isCash) {
        payload.downpayment = srp;
        payload.terms = 0;
        payload.address = '';
        payload.brand = '';
        payload.model = '';
        payload.serial_number = '';
        payload.purchase_date = new Date().toISOString().split('T')[0];
    } else {
        payload.address = document.getElementById('address').value;
        payload.brand = document.getElementById('brand').value;
        payload.model = document.getElementById('model').value;
        payload.serial_number = document.getElementById('serial_number').value;
        payload.purchase_date = document.getElementById('purchase_date').value;
        payload.downpayment = parseFloat(document.getElementById('downpayment').value) || 0;
        payload.terms = parseInt(document.getElementById('terms').value) || 12;
    }

    try {
        await api('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Customer added successfully', 'success');
        closeModal();
        loadCustomers();
    } catch (error) {
        // Error handled by api()
    }
}

function openEditCustomerModal(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;

    openModal(`
        <div class="modal-header">
            <h2>Edit Customer</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <form id="customer-form" onsubmit="editCustomer(event, ${customerId})">
            <div class="form-group">
                <label for="name">Name *</label>
                <input type="text" id="name" value="${escapeHtml(customer.name)}" required>
            </div>
            <div class="form-group">
                <label for="address">Address</label>
                <input type="text" id="address" value="${escapeHtml(customer.address)}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="brand">Brand</label>
                    <input type="text" id="brand" value="${escapeHtml(customer.brand)}">
                </div>
                <div class="form-group">
                    <label for="model">Model</label>
                    <input type="text" id="model" value="${escapeHtml(customer.model)}">
                </div>
            </div>
            <div class="form-group">
                <label for="serial_number">Serial Number</label>
                <input type="text" id="serial_number" value="${escapeHtml(customer.serial_number)}">
            </div>
            <div class="form-group">
                <label for="purchase_date">Purchase Date</label>
                <input type="date" id="purchase_date" value="${customer.purchase_date}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="srp">SRP (₱)</label>
                    <input type="number" id="srp" min="0" step="0.01" value="${customer.srp}" oninput="previewInstallment()">
                </div>
                <div class="form-group">
                    <label for="downpayment">Down Payment (₱)</label>
                    <input type="number" id="downpayment" min="0" step="0.01" value="${customer.downpayment}" oninput="previewInstallment()">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="terms">Terms (months)</label>
                    <input type="number" id="terms" min="1" value="${customer.terms}" oninput="previewInstallment()">
                </div>
                <div class="form-group">
                    <label>Monthly Installment</label>
                    <input type="text" id="monthly-preview" readonly style="background: var(--bg-cream); font-weight: 700;">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
        </form>
    `);
    previewInstallment();
}

async function editCustomer(event, customerId) {
    event.preventDefault();
    try {
        await api(`/api/customers/${customerId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: document.getElementById('name').value,
                address: document.getElementById('address').value,
                brand: document.getElementById('brand').value,
                model: document.getElementById('model').value,
                serial_number: document.getElementById('serial_number').value,
                purchase_date: document.getElementById('purchase_date').value,
                srp: parseFloat(document.getElementById('srp').value) || 0,
                downpayment: parseFloat(document.getElementById('downpayment').value) || 0,
                terms: parseInt(document.getElementById('terms').value) || 12
            })
        });
        showToast('Customer updated successfully', 'success');
        closeModal();
        loadCustomers();
    } catch (error) {
        // Error handled by api()
    }
}

// ============================================
// DELETE
// ============================================

function confirmDelete(customerId, customerName) {
    showConfirm(
        'Delete Customer',
        `Are you sure you want to delete "${customerName}"? This will also remove all payment history. This action cannot be undone.`,
        async () => {
            try {
                await api(`/api/customers/${customerId}`, { method: 'DELETE' });
                showToast('Customer deleted', 'success');
                expandedCards.delete(customerId);
                loadCustomers();
            } catch (error) {
                // Error handled by api()
            }
        }
    );
}

// ============================================
// PAYMENT
// ============================================

function openPaymentModal(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;

    const today = new Date().toISOString().split('T')[0];

    openModal(`
        <div class="modal-header">
            <h2>Add Payment</h2>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="payment-info-box">
            <strong>${escapeHtml(customer.name)}</strong> — ${escapeHtml(customer.brand)} ${escapeHtml(customer.model)}<br>
            <span style="font-weight: 700;">Balance: ${formatCurrency(customer.balance)}</span>
        </div>
        <form id="payment-form" onsubmit="addPayment(event, ${customerId})">
            <div class="form-group">
                <label for="payment_date">Payment Date *</label>
                <input type="date" id="payment_date" value="${today}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="amount">Amount (₱) *</label>
                    <input type="number" id="amount" min="0.01" step="0.01" max="${customer.balance}" required>
                </div>
                <div class="form-group">
                    <label for="rebate">Rebate (₱)</label>
                    <input type="number" id="rebate" min="0" step="0.01" value="0">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" onclick="closeModal()" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Payment</button>
            </div>
        </form>
    `);
}

async function addPayment(event, customerId) {
    event.preventDefault();
    try {
        await api('/api/payments', {
            method: 'POST',
            body: JSON.stringify({
                customer_id: customerId,
                payment_date: document.getElementById('payment_date').value,
                amount: parseFloat(document.getElementById('amount').value),
                rebate: parseFloat(document.getElementById('rebate').value) || 0
            })
        });
        showToast('Payment recorded successfully', 'success');
        closeModal();
        loadCustomers();
    } catch (error) {
        // Error handled by api()
    }
}

// ============================================
// SEARCH & SORT
// ============================================

function searchCustomers() {
    currentPage = 1;
    renderCustomers();
}

function sortCustomers() {
    currentPage = 1;
    renderCustomers();
}

function sortCustomerList(customers, sortBy) {
    const sorted = [...customers];
    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'balance-desc':
            sorted.sort((a, b) => b.balance - a.balance);
            break;
        case 'balance-asc':
            sorted.sort((a, b) => a.balance - b.balance);
            break;
        case 'due-date':
            sorted.sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));
            break;
        case 'newest':
        default:
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }
    return sorted;
}

// ============================================
// EXPORT / IMPORT
// ============================================

async function exportData() {
    try {
        showLoading();
        const customers = await api('/api/customers');
        const exportPayload = { customers, exportDate: new Date().toISOString() };

        // Fetch payments for each customer
        for (const customer of exportPayload.customers) {
            const payments = await api(`/api/payments/${customer.id}`);
            customer.payments = payments;
        }

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `installment-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully', 'success');
    } catch (error) {
        showToast('Failed to export data', 'error');
    } finally {
        hideLoading();
    }
}

function importData() {
    document.getElementById('import-file').click();
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showConfirm(
        'Import Data',
        'This will add all customers and payments from the backup file. Existing data will not be affected. Continue?',
        async () => {
            try {
                showLoading();
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.customers || !Array.isArray(data.customers)) {
                    throw new Error('Invalid backup file format');
                }

                for (const customer of data.customers) {
                    const { payments, ...customerData } = customer;
                    const result = await api('/api/customers', {
                        method: 'POST',
                        body: JSON.stringify(customerData)
                    });

                    if (payments && payments.length > 0) {
                        for (const payment of payments) {
                            await api('/api/payments', {
                                method: 'POST',
                                body: JSON.stringify({
                                    customer_id: result.id,
                                    payment_date: payment.payment_date,
                                    amount: payment.amount,
                                    rebate: payment.rebate || 0
                                })
                            });
                        }
                    }
                }

                showToast(`Imported ${data.customers.length} customers`, 'success');
                loadCustomers();
            } catch (error) {
                showToast('Failed to import data: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );

    // Reset file input
    event.target.value = '';
}

// ============================================
// PRINT LEDGER
// ============================================

function printLedger(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ledger - ${customer.name}</title>
            <link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'IBM Plex Mono', monospace;
                    padding: 2rem;
                    color: #1A1A1A;
                    background: #fff;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .receipt-border {
                    border: 3px double #1A365D;
                    padding: 2rem 1.5rem;
                    position: relative;
                }
                .receipt-border::before {
                    content: '';
                    position: absolute;
                    top: 6px; left: 6px; right: 6px; bottom: 6px;
                    border: 1px solid #1A365D;
                    pointer-events: none;
                }
                .store-header {
                    text-align: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px dashed #2B6CB0;
                }
                .store-name {
                    font-family: 'Special Elite', cursive;
                    font-size: 1.8rem;
                    color: #1A365D;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    margin-bottom: 0.25rem;
                }
                .store-divider {
                    font-family: 'Special Elite', cursive;
                    color: #2B6CB0;
                    font-size: 1.2rem;
                    letter-spacing: 6px;
                    margin-bottom: 0.25rem;
                }
                .store-tagline {
                    font-size: 0.7rem;
                    color: #4A8EC7;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                .receipt-title {
                    font-family: 'Special Elite', cursive;
                    font-size: 1.2rem;
                    color: #1A365D;
                    text-align: center;
                    margin-bottom: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 4px;
                }
                .receipt-info {
                    font-size: 0.8rem;
                    margin-bottom: 1.25rem;
                    padding: 0.75rem 1rem;
                    background: #F7FAFF;
                    border-left: 4px solid #2B6CB0;
                }
                .receipt-info p { margin-bottom: 0.25rem; }
                .receipt-info p:last-child { margin-bottom: 0; }
                .receipt-info .label { color: #2B6CB0; }
                .summary-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.4rem 1.5rem;
                    margin-bottom: 1.25rem;
                    padding: 0.75rem 1rem;
                    border: 1px solid #E2E8F0;
                    border-radius: 4px;
                    font-size: 0.8rem;
                }
                .summary-grid .label { color: #4A8EC7; }
                .summary-grid .value { font-weight: 600; color: #1A365D; }
                .summary-grid .full { grid-column: 1 / -1; }
                .summary-grid .balance-row {
                    grid-column: 1 / -1;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 0.4rem;
                    margin-top: 0.4rem;
                    border-top: 2px solid #1A365D;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #1A365D;
                }
                .print-date {
                    text-align: center;
                    font-size: 0.65rem;
                    color: #999;
                    margin-bottom: 0.75rem;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.78rem;
                    margin-top: 0.25rem;
                }
                thead th {
                    background: #1A365D;
                    color: #fff;
                    padding: 0.55rem 0.5rem;
                    text-align: left;
                    text-transform: uppercase;
                    font-size: 0.65rem;
                    letter-spacing: 1px;
                    font-weight: 600;
                }
                thead th:first-child { border-radius: 4px 0 0 0; }
                thead th:last-child { border-radius: 0 4px 0 0; }
                tbody td {
                    padding: 0.5rem;
                    border-bottom: 1px solid #E2E8F0;
                }
                tbody tr:nth-child(even) { background: #F7FAFF; }
                tbody tr:hover { background: #EDF2F7; }
                tbody tr.total td {
                    background: #EDF2F7;
                    border-top: 2px solid #1A365D;
                    font-weight: 700;
                    color: #1A365D;
                }
                .status-badge {
                    display: inline-block;
                    padding: 0.15rem 0.6rem;
                    border-radius: 3px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .status-ACTIVE { background: #EBF8FF; color: #2B6CB0; }
                .status-PAID { background: #F0FFF4; color: #276749; }
                .status-OVERDUE { background: #FFF5F5; color: #C53030; }
                .footer-brand {
                    text-align: center;
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 2px dashed #2B6CB0;
                    font-family: 'Special Elite', cursive;
                    font-size: 0.75rem;
                    color: #4A8EC7;
                }
                @media print {
                    body { padding: 0.5rem; }
                    .receipt-border { border-color: #1A365D; }
                    thead th { background: #1A365D !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    tbody tr:nth-child(even) { background: #F7FAFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    tbody tr.total td { background: #EDF2F7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .status-ACTIVE { background: #EBF8FF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .status-PAID { background: #F0FFF4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .status-OVERDUE { background: #FFF5F5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .receipt-info { background: #F7FAFF !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                @page { margin: 0.5in; }
            </style>
        </head>
        <body>
            <div class="receipt-border">
                <div class="store-header">
                    <div class="store-name">JEZZ APPLIANCES</div>
                    <div class="store-divider">✦ ✦ ✦ ✦ ✦</div>
                    <div class="store-tagline">Official Installment Ledger</div>
                </div>

                <div class="receipt-title">Customer Ledger</div>

                <div class="receipt-info">
                    <p><span class="label">Customer:</span> ${escapeHtml(customer.name)}</p>
                    <p><span class="label">Address:</span> ${escapeHtml(customer.address) || '—'}</p>
                    <p><span class="label">Item:</span> ${escapeHtml(customer.brand)} ${escapeHtml(customer.model)}</p>
                    <p><span class="label">Serial #:</span> ${escapeHtml(customer.serial_number) || '—'}</p>
                    <p><span class="label">Purchase Date:</span> ${formatDate(customer.purchase_date)}</p>
                </div>

                <div class="summary-grid">
                    <div><span class="label">SRP</span><br><span class="value">${formatCurrency(customer.srp)}</span></div>
                    <div><span class="label">Down Payment</span><br><span class="value">${formatCurrency(customer.downpayment)}</span></div>
                    <div><span class="label">Terms</span><br><span class="value">${customer.terms} month${customer.terms !== 1 ? 's' : ''}</span></div>
                    <div><span class="label">Monthly</span><br><span class="value">${formatCurrency(customer.monthly_installment)}</span></div>
                    <div class="balance-row">
                        <span>BALANCE</span>
                        <span>${formatCurrency(customer.balance)}</span>
                    </div>
                    <div class="full" style="text-align:center;margin-top:0.25rem;">
                        <span class="status-badge status-${customer.status}">${customer.status}</span>
                    </div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:1rem;">
                    <div style="font-family:'Special Elite',cursive;font-size:0.95rem;color:#1A365D;">Payment History</div>
                    <div class="print-date">Printed ${new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })}</div>
                </div>

                <div id="payments-table" style="margin-top:0.25rem;">
                    <table>
                        <thead><tr><th>#</th><th>Date</th><th>Amount</th><th>Rebate</th><th>Net</th></tr></thead>
                        <tbody><tr><td colspan="5" style="text-align:center;padding:1rem;color:#999;">Loading payments...</td></tr></tbody>
                    </table>
                </div>

                <div class="footer-brand">Created by ChandeM.</div>
            </div>

            <script>
                fetch('/api/payments/${customer.id}')
                    .then(r => r.json())
                    .then(payments => {
                        const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
                        const totalRebate = payments.reduce((s, p) => s + (p.rebate || 0), 0);
                        let html = '<table><thead><tr><th>#</th><th>Date</th><th>Amount</th><th>Rebate</th><th>Net</th></tr></thead><tbody>';
                        payments.forEach((p, i) => {
                            html += '<tr>';
                            html += '<td style="color:#999;font-size:0.7rem;">' + (i + 1) + '</td>';
                            html += '<td>' + new Date(p.payment_date).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) + '</td>';
                            html += '<td>' + '₱' + p.amount.toLocaleString(undefined, {minimumFractionDigits:2}) + '</td>';
                            html += '<td>' + (p.rebate > 0 ? '₱' + p.rebate.toLocaleString(undefined, {minimumFractionDigits:2}) : '—') + '</td>';
                            html += '<td>' + '₱' + (p.amount - (p.rebate||0)).toLocaleString(undefined, {minimumFractionDigits:2}) + '</td>';
                            html += '</tr>';
                        });
                        html += '<tr class="total"><td colspan="2"><strong>Total Paid</strong></td>';
                        html += '<td><strong>₱' + totalPaid.toLocaleString(undefined, {minimumFractionDigits:2}) + '</strong></td>';
                        html += '<td>' + (totalRebate > 0 ? '₱' + totalRebate.toLocaleString(undefined, {minimumFractionDigits:2}) : '—') + '</td>';
                        html += '<td><strong>₱' + (totalPaid - totalRebate).toLocaleString(undefined, {minimumFractionDigits:2}) + '</strong></td></tr>';
                        html += '</tbody></table>';
                        document.getElementById('payments-table').innerHTML = html;
                    });
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
}

// ============================================
// MODAL HELPERS
// ============================================

function openModal(content) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = content;
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function showConfirm(title, message, callback) {
    confirmCallback = callback;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-dialog').classList.remove('hidden');
}

function closeConfirm() {
    document.getElementById('confirm-dialog').classList.add('hidden');
    confirmCallback = null;
}

document.getElementById('confirm-btn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeConfirm();
    }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount) {
    return '₱' + Number(amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getDisplayStatus(customer) {
    if (customer.status === 'PAID') {
        return { label: 'PAID', class: 'badge-paid' };
    }

    const today = new Date().toISOString().split('T')[0];
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekStr = weekFromNow.toISOString().split('T')[0];

    if (customer.next_due_date < today) {
        return { label: 'OVERDUE', class: 'badge-overdue' };
    }
    if (customer.next_due_date <= weekStr) {
        return { label: 'DUE SOON', class: 'badge-due-soon' };
    }
    return { label: 'ACTIVE', class: 'badge-active' };
}

function showLoading() {
    document.getElementById('loading-spinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-spinner').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
