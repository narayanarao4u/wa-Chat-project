const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '10.34.130.254',
    user: 'bsnlvm',
    password: 'bsnl@123',
    database: 'ipScanDb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool to use promises
const promisePool = pool.promise();

// Initialize database tables
async function initializeDatabase() {
    try {
        // Customers table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mobile_no VARCHAR(15) ,
                landline_no VARCHAR(20),
                isValid VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Feedbacks table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_feedbacks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                mobile_no VARCHAR(15),
                feedback TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Initialize tables
initializeDatabase();

const dbOps = {
    // Add customer from CSV
    addCustomer: async (mobileNo, landlineNo, isValid) => {
        try {
            await promisePool.query(
                // 'INSERT INTO whatsapp_customers (mobile_no, landline_no, isValid) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE landline_no = ?',
                'INSERT INTO whatsapp_customers (mobile_no, landline_no, isValid) VALUES (?, ?, ?) ',
                [mobileNo, landlineNo, isValid]
            );
            return { success: true };
        } catch (error) {
            console.error('Error adding customer:', error);
            return { success: false, error };
        }
    },

    // Check if customer exists and save feedback
    saveFeedback: async (mobileNo, feedback) => {
        try {
            // First check if customer exists
            const [customers] = await promisePool.query(
                'SELECT mobile_no FROM whatsapp_customers WHERE mobile_no = ?',
                [mobileNo]
            );
                   
            if (customers.length === 0) {
                return { success: false, message: "Mobile number not found in customers list" };
            }

            // Check for duplicate feedback in last 5 minutes
            const [recentFeedbacks] = await promisePool.query(
                `SELECT * FROM whatsapp_feedbacks 
                WHERE mobile_no = ? 
                AND feedback = ?
                AND created_at >= NOW() - INTERVAL 5 MINUTE`,
                [mobileNo, feedback]
            );

            if (recentFeedbacks.length > 0) {
                return { success: false, message: "Duplicate feedback detected" };
            }

            // Save feedback if no recent duplicate
            console.log('Saving feedback:', mobileNo, feedback);
            await promisePool.query(
                'INSERT INTO whatsapp_feedbacks (mobile_no, feedback) VALUES (?, ?)',
                [mobileNo, feedback]
            );

            return { success: true, message: "Feedback saved successfully" };
        } catch (error) {
            console.error('Error saving feedback:', error);
            return { success: false, error: error.message };
        }
    },

    // Get all feedbacks with customer info
    getFeedbacks: async () => {
        try {
            const [rows] = await promisePool.query(`
                SELECT 
                    f.created_at as timestamp,
                    f.mobile_no as mobileNo,
                    c.landline_no as landlineNo,
                    f.feedback
                FROM whatsapp_feedbacks f
                LEFT JOIN whatsapp_customers c ON f.mobile_no = c.mobile_no
                ORDER BY f.created_at DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error getting feedbacks:', error);
            throw error;
        }
    },

    // Get customer by mobile number
    getCustomer: async (mobileNo) => {
        try {
            const [rows] = await promisePool.query(
                'SELECT * FROM whatsapp_customers WHERE mobile_no = ?',
                [mobileNo]
            );
            return rows[0];
        } catch (error) {
            console.error('Error getting customer:', error);
            throw error;
        }
    },

    // Get feedback statistics
    getFeedbackStats: async () => {
        try {
            const [daily] = await promisePool.query(`
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM whatsapp_feedbacks
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `);

            const [distribution] = await promisePool.query(`
                SELECT feedback, COUNT(*) as count
                FROM whatsapp_feedbacks
                GROUP BY feedback
                ORDER BY count DESC
            `);

            const [customerStats] = await promisePool.query(`
                SELECT 
                    COUNT(DISTINCT mobile_no) as unique_customers,
                    COUNT(*) as total_feedbacks
                FROM whatsapp_feedbacks
            `);

            return { daily, distribution, customerStats: customerStats[0] };
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            throw error;
        }
    }
};

module.exports = dbOps;
