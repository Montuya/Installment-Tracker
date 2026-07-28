# Installment Tracker System — Design Spec

## Overview

Offline installment tracking system for a small appliance store. Runs on one laptop. Node.js + Express + SQLite3 backend, vanilla HTML/CSS/JS frontend.

## Architecture

```
Browser (SPA)
  ↓ fetch()
Express Server (server.js)
  ├── /api/customers → routes/customers.js
  └── /api/payments  → routes/payments.js
         ↓
  SQLite3 (database/database.js)
  └── database.db (auto-created)
```

## Data Model

### customers
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Required |
| address | TEXT | |
| brand | TEXT | Appliance brand |
| model | TEXT | Appliance model |
| serial_number | TEXT | |
| purchase_date | TEXT | ISO date |
| srp | REAL | Suggested retail price |
| downpayment | REAL | |
| terms | INTEGER | Number of months |
| monthly_installment | REAL | Auto-calculated |
| total_amount | REAL | SRP |
| balance | REAL | Decrements on payment |
| next_due_date | TEXT | Advances 1 month per payment |
| status | TEXT | ACTIVE/PAID/OVERDUE/DUE SOON |
| created_at | TEXT | Default CURRENT_TIMESTAMP |

### payments
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| customer_id | INTEGER FK | References customers.id |
| payment_date | TEXT | ISO date |
| amount | REAL | Payment amount |
| rebate | REAL | Discount/rebate |
| created_at | TEXT | Default CURRENT_TIMESTAMP |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/customers | List all customers |
| GET | /api/customers/:id | Get single customer |
| POST | /api/customers | Create customer |
| PUT | /api/customers/:id | Update customer |
| DELETE | /api/customers/:id | Delete customer + payments |
| GET | /api/payments/:customerId | Get payment history |
| POST | /api/payments | Add payment (auto-updates balance/due/status) |

## Business Logic

### On Customer Creation
- monthly_installment = (total_amount - downpayment) / terms
- balance = total_amount - downpayment
- status = ACTIVE

### On Payment
- balance -= (amount - rebate)
- Prevent negative balance (reject if payment > balance)
- next_due_date += 1 month
- If balance ≤ 0: status = PAID

### Status Determination (on fetch)
- PAID: balance ≤ 0
- OVERDUE: next_due_date < today
- DUE SOON: next_due_date within 7 days from today
- ACTIVE: otherwise

## Frontend

Single page with:
- Dashboard (stats cards)
- Search + Sort controls
- Customer accordion cards
- Modal for forms (add/edit customer, add payment)
- Toast notifications
- Print ledger capability
- Export/Import JSON

## Design Theme — Old Ledger Book

- Background: cream (#F5F0E8)
- Primary: forest green (#2D5A3D)
- Text: black (#1A1A1A)
- Overdue: red (#C0392B)
- Gold highlight: #C9A84C
- Fonts: Special Elite (headings), IBM Plex Mono (body)
- Cards: rounded corners, soft shadow, paper texture feel

## File Structure

```
installment-tracker/
├── package.json
├── server.js
├── database/
│   ├── database.js
│   └── schema.sql
├── routes/
│   ├── customers.js
│   └── payments.js
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
