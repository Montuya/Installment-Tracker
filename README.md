# Installment Tracker — Appliance Store

Offline installment tracking system for appliance stores. Built with Node.js, Express, SQLite3, and vanilla HTML/CSS/JS.

## Features

- **Customer Management** — Add, edit, delete customers with full details (name, address, brand, model, serial no.)
- **Cash / Installment Toggle** — Checkbox instantly switches between cash and installment modes
- **Payment Tracking** — Record payments with rebates, auto-calculated balance
- **Dashboard Stats** — Total customers, cash/installment counts, outstanding balance, due within 7 days, overdue count
- **Search & Sort** — Search by name/brand/model, sort by any field
- **Pagination** — 20 customers per page
- **Import / Export** — JSON export/import for data portability
- **Auto Backup** — Automatic backup to `backups/` folder on server shutdown
- **Integrity Check** — Database integrity verification on startup
- **Blue Ledger Theme** — Special Elite + IBM Plex Mono fonts, cream paper background

## Quick Start

### Option A: Portable (no installation needed)

1. Download or copy the folder to any Windows PC
2. Double-click `start.bat`
3. Browser opens to `http://localhost:3000`

Portable Node.js is bundled in the `node/` folder — no separate installation required.

### Option B: With Node.js installed

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

### Option C: From GitHub

```bash
git clone <repo-url>
cd installment-tracker
npm install
npm start
```

## Usage

- **Add Customer** — Click "Add Customer", fill out the form, click Save
- **Cash Customer** — Check the "Cash Customer" box → downpayment auto-fills to SRP, terms = 0, status = PAID
- **View Details** — Click a customer card to expand and see payment history
- **Record Payment** — In the expanded view, click "Add Payment", enter amount and optional rebate
- **Edit / Delete** — Use the edit and delete buttons on each card
- **Search** — Type in the search box to filter customers
- **Sort** — Click column headers in the sortable table

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers |
| GET | `/api/customers/:id` | Get customer with payments |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |
| POST | `/api/payments` | Add payment |
| DELETE | `/api/payments/:id` | Delete payment |
| GET | `/api/export` | Export all data as JSON |
| POST | `/api/import` | Import data from JSON |

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3
- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework)
- **Database:** SQLite3
- **Fonts:** Special Elite, IBM Plex Mono

## License

MIT
