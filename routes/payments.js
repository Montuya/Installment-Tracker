const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/database');

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
            'INSERT INTO payments (customer_id, payment_date, amount, rebate) VALUES (?, ?, ?, ?)'
        ).run(customer_id, payment_date, amount, rebate || 0);

        // Update customer balance — decrease by full payment amount
        const newBalance = customer.balance - amount;

        // Advance next due date by 1 month
        const currentDue = new Date(customer.next_due_date);
        currentDue.setMonth(currentDue.getMonth() + 1);
        const newDueDate = currentDue.toISOString().split('T')[0];

        // Determine status
        let status = 'ACTIVE';
        if (newBalance <= 0) {
            status = 'PAID';
        }

        db.prepare(`
            UPDATE customers SET
                balance = ?,
                next_due_date = ?,
                status = ?
            WHERE id = ?
        `).run(Math.max(0, newBalance), newDueDate, status, customer_id);

        // Return updated customer with payment
        const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({ payment, customer: updatedCustomer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
