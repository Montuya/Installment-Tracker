const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/database');
const { computeMonthsBehind } = require('./monthsBehind');

// GET /api/payments/monthly - Get monthly collections
router.get('/monthly', (req, res) => {
    try {
        const db = getDatabase();
        const rows = db.prepare(`
            SELECT substr(payment_date, 1, 7) as month, SUM(amount) as total
            FROM payments WHERE type != 'penalty'
            GROUP BY month ORDER BY month DESC LIMIT 12
        `).all();
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/:customerId - Get payment history for a customer
router.get('/:customerId', (req, res) => {
    try {
        const db = getDatabase();
        const payments = db.prepare(
            'SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC'
        ).all(req.params.customerId);

        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function addMonth(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() !== day) d.setDate(0);
    return d.toISOString().split('T')[0];
}

// POST /api/payments - Add payment
router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { customer_id, payment_date, amount, rebate } = req.body;

        if (!customer_id || !payment_date || amount === undefined) {
            return res.status(400).json({
                error: 'customer_id, payment_date, and amount are required'
            });
        }

        // Get customer
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Prevent negative balance — balance decreases by full payment amount
        if (amount > customer.balance) {
            return res.status(400).json({
                error: `Payment amount (₱${amount}) exceeds remaining balance (₱${customer.balance})`
            });
        }

        // Insert payment
        const result = db.prepare(
            'INSERT INTO payments (customer_id, payment_date, amount, rebate, type) VALUES (?, ?, ?, ?, ?)'
        ).run(customer_id, payment_date, amount, rebate || 0, 'payment');

        // Update customer balance — decrease by full payment amount
        const newBalance = customer.balance - amount;

        // Advance due date only if enough to cover monthly installment
        let newDueDate = customer.next_due_date || '';
        if (customer.monthly_installment > 0) {
            const monthsCovered = Math.floor(amount / customer.monthly_installment);
            if (monthsCovered >= 1) {
                let d = customer.next_due_date;
                for (let i = 0; i < monthsCovered; i++) d = addMonth(d);
                newDueDate = d;
            }
        } else if (customer.next_due_date) {
            newDueDate = addMonth(customer.next_due_date);
        }

        // Determine status
        let status = 'ACTIVE';
        if (newBalance <= 0) {
            status = 'PAID';
        }

        const totalPaid = customer.total_amount - customer.balance + amount - (customer.downpayment || 0);
        const monthsBehind = computeMonthsBehind(customer.purchase_date, customer.monthly_installment, totalPaid, customer.terms);

        db.prepare(`
            UPDATE customers SET
                balance = ?,
                next_due_date = ?,
                status = ?,
                months_behind = ?
            WHERE id = ?
        `).run(Math.max(0, newBalance), newDueDate, status, monthsBehind, customer_id);

        // Return updated customer with payment
        const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({ payment, customer: updatedCustomer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/customers/:id/penalty - Add penalty to customer balance
router.post('/customer/:id/penalty', (req, res) => {
    try {
        const db = getDatabase();
        const { amount, notes } = req.body;
        const customerId = req.params.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Penalty amount must be greater than 0' });
        }

        // Get customer
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Insert penalty as a negative payment record (increases balance)
        const paymentDate = new Date().toISOString().split('T')[0];
        const result = db.prepare(
            'INSERT INTO payments (customer_id, payment_date, amount, rebate, type, notes) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(customerId, paymentDate, amount, 0, 'penalty', notes || '');

        // Update customer balance — increase by penalty amount
        const newBalance = customer.balance + amount;
        const totalPaid = customer.total_amount - newBalance - (customer.downpayment || 0);
        const monthsBehind = computeMonthsBehind(customer.purchase_date, customer.monthly_installment, totalPaid, customer.terms);

        db.prepare(`
            UPDATE customers SET
                balance = ?,
                months_behind = ?
            WHERE id = ?
        `).run(newBalance, monthsBehind, customerId);

        // Return updated customer with penalty
        const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        const penalty = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({ payment: penalty, customer: updatedCustomer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
