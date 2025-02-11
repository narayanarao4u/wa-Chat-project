const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'whatsapp.db'));

// Initialize database tables
db.serialize(() => {
    // Customers table for uploaded CSV data
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile_no TEXT UNIQUE,
        landline_no TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Feedbacks table
    db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile_no TEXT,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(mobile_no) REFERENCES customers(mobile_no)
    )`);
});

const dbOps = {
    // Add customer from CSV
    addCustomer: (mobileNo, landlineNo) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT OR REPLACE INTO customers (mobile_no, landline_no) VALUES (?, ?)',
                [mobileNo, landlineNo],
                (err) => err ? reject(err) : resolve()
            );
        });
    },

    // Save feedback
    saveFeedback: (mobileNo, feedback) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO feedbacks (mobile_no, feedback) VALUES (?, ?)',
                [mobileNo, feedback],
                (err) => err ? reject(err) : resolve()
            );
        });
    },

    // Get all feedbacks with customer info
    getFeedbacks: () => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    f.created_at as timestamp,
                    f.mobile_no as mobileNo,
                    c.landline_no as landlineNo,
                    f.feedback
                FROM feedbacks f
                LEFT JOIN customers c ON f.mobile_no = c.mobile_no
                ORDER BY f.created_at DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Get customer by mobile number
    getCustomer: (mobileNo) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM customers WHERE mobile_no = ?',
                [mobileNo],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
    }
};

module.exports = dbOps;
