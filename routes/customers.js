const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/database');

// GET /api/customers - List all customers
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/customers/:id - Get single customer
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get payment history
        const payments = db.prepare(
            'SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC'
        ).all(req.params.id);

        res.json({ ...customer, payments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/customers - Create customer
router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const {
            name, address, brand, model, serial_number,
            purchase_date, srp, downpayment, terms
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Auto-calculate
        const totalAmount = srp || 0;
        const balance = totalAmount - (downpayment || 0);
        const monthlyInstallment = terms > 0 ? balance / terms : 0;
        const nextDueDate = purchase_date || new Date().toISOString().split('T')[0];

        const result = db.prepare(`
            INSERT INTO customers (
                name, address, brand, model, serial_number,
                purchase_date, srp, downpayment, terms,
                monthly_installment, total_amount, balance,
                next_due_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            name, address || '', brand || '', model || '', serial_number || '',
            purchase_date || '', totalAmount, downpayment || 0, terms || 0,
            monthlyInstallment, totalAmount, balance,
            nextDueDate, balance > 0 ? 'ACTIVE' : 'PAID'
        );

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

        if (!existing) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const {
            name, address, brand, model, serial_number,
            purchase_date, srp, downpayment, terms
        } = req.body;

        // Recalculate if financial fields changed
        const totalAmount = srp !== undefined ? srp : existing.total_amount;
        const dp = downpayment !== undefined ? downpayment : existing.downpayment;
        const newTerms = terms !== undefined ? terms : existing.terms;
        const totalPaid = existing.total_amount - existing.balance;
        const newBalance = totalAmount - dp - totalPaid;
        const monthlyInstallment = newTerms > 0 ? (totalAmount - dp) / newTerms : 0;

        let status = existing.status;
        if (newBalance <= 0) status = 'PAID';
        else if (existing.next_due_date < new Date().toISOString().split('T')[0]) status = 'OVERDUE';
        else status = 'ACTIVE';

        db.prepare(`
            UPDATE customers SET
                name = ?, address = ?, brand = ?, model = ?, serial_number = ?,
                purchase_date = ?, srp = ?, downpayment = ?, terms = ?,
                monthly_installment = ?, total_amount = ?, balance = ?, status = ?
            WHERE id = ?
        `).run(
            name || existing.name,
            address !== undefined ? address : existing.address,
            brand !== undefined ? brand : existing.brand,
            model !== undefined ? model : existing.model,
            serial_number !== undefined ? serial_number : existing.serial_number,
            purchase_date !== undefined ? purchase_date : existing.purchase_date,
            totalAmount, dp, newTerms,
            monthlyInstallment, totalAmount, Math.max(0, newBalance), status,
            req.params.id
        );

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/customers/:id - Delete customer and payments
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Delete payments first, then customer
        db.prepare('DELETE FROM payments WHERE customer_id = ?').run(req.params.id);
        db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
