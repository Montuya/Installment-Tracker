const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const schema = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Database file stored in project root
const DB_PATH = path.join(__dirname, '..', 'database.db');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 30;

let db;

function getDatabase() {
    if (db) return db;

    db = new Database(DB_PATH);

    // Enable WAL mode for better performance and crash safety
    db.pragma('journal_mode = WAL');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables from schema
    db.exec(schema);

    // Migrate: add months_behind if not present (existing DBs)
    try {
        db.prepare('SELECT months_behind FROM customers LIMIT 1').get();
    } catch {
        db.prepare('ALTER TABLE customers ADD COLUMN months_behind INTEGER DEFAULT 0').run();
    }

    // Migrate: add type column to payments if not present
    try {
        db.prepare('SELECT type FROM payments LIMIT 1').get();
    } catch {
        db.prepare('ALTER TABLE payments ADD COLUMN type TEXT DEFAULT "payment"').run();
    }

    // Migrate: add notes column to payments if not present
    try {
        db.prepare('SELECT notes FROM payments LIMIT 1').get();
    } catch {
        db.prepare('ALTER TABLE payments ADD COLUMN notes TEXT DEFAULT ""').run();
    }

    // Run integrity check on startup
    const result = db.pragma('integrity_check');
    if (result[0].integrity_check !== 'ok') {
        console.error('WARNING: Database integrity check failed!');
        console.error('Result:', result[0].integrity_check);
    } else {
        console.log('Database integrity check: OK');
    }

    console.log('Database initialized at:', DB_PATH);
    return db;
}

function backupDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) return;

        // Create backups directory if it doesn't exist
        if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }

        // Generate timestamped filename
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .slice(0, 19);
        const backupPath = path.join(BACKUPS_DIR, `database-${timestamp}.db`);

        // Copy database file
        fs.copyFileSync(DB_PATH, backupPath);
        console.log('Backup created:', backupPath);

        // Cleanup old backups — keep only MAX_BACKUPS most recent
        cleanupOldBackups();
    } catch (error) {
        console.error('Backup failed:', error.message);
    }
}

function cleanupOldBackups() {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) return;

        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.startsWith('database-') && f.endsWith('.db'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // newest first

        // Delete backups beyond the limit
        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(file => {
                fs.unlinkSync(path.join(BACKUPS_DIR, file.name));
                console.log('Old backup removed:', file.name);
            });
        }
    } catch (error) {
        console.error('Backup cleanup failed:', error.message);
    }
}

function closeDatabase() {
    if (db) {
        // Backup before closing
        backupDatabase();

        db.close();
        db = null;
        console.log('Database closed safely.');
    }
}

module.exports = { getDatabase, closeDatabase, backupDatabase };
