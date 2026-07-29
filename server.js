const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDatabase, closeDatabase } = require('./database/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files with cache busting
app.get('/app.js', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'app.js'));
});
app.get('/style.css', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'style.css'));
});
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
getDatabase();

// Routes
app.use('/api/customers', require('./routes/customers'));
app.use('/api/payments', require('./routes/payments'));

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Installment Tracker running at http://localhost:${PORT}`);
});

// ============================================
// SHUTDOWN HANDLERS
// Ensures database backup runs on all exit scenarios
// ============================================

// Graceful shutdown (Ctrl+C in terminal)
process.on('SIGINT', () => {
    console.log('\nShutting down (SIGINT)...');
    closeDatabase();
    server.close(() => process.exit(0));
});

// SIGTERM (service stop)
process.on('SIGTERM', () => {
    console.log('\nShutting down (SIGTERM)...');
    closeDatabase();
    server.close(() => process.exit(0));
});

// Windows: triggered when terminal window is closed or `taskkill`
process.on('exit', (code) => {
    console.log(`Process exiting (code: ${code})...`);
    closeDatabase();
});

// Catch unhandled errors — backup before crashing
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    closeDatabase();
    process.exit(1);
});
