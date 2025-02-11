const dbOps = require('./database');
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '10.34.130.254',
    user: 'bsnlvm',
    password: 'bsnl@123',
    database: 'ipScanDb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

const sampleFeedbacks = [
    "Service is excellent",
    "Network issues in my area",
    "Need better internet speed",
    "Customer support was helpful",
    "Connection keeps dropping",
    "Very satisfied with the service",
    "Bills are too high",
    "Installation was quick",
    "Poor signal strength",
    "Great improvement in service"
];

const sampleMobileNumbers = [
    "9876543210",
    "9876543211",
    "9876543212",
    "9876543213",
    "9876543214"
];

function getRandomDate(daysBack = 30) {
    const date = new Date();
    date.setDate(date.getDate() - Math.random() * daysBack);
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function insertDummyFeedbacks() {
    try {
        // First, insert sample customers if they don't exist
        for (const mobile of sampleMobileNumbers) {
            await dbOps.addCustomer(mobile, `040${Math.floor(Math.random() * 1000000)}`);
        }

        // Insert 150 dummy feedbacks
        for (let i = 0; i < 150; i++) {
            const randomMobile = sampleMobileNumbers[Math.floor(Math.random() * sampleMobileNumbers.length)];
            const randomFeedback = sampleFeedbacks[Math.floor(Math.random() * sampleFeedbacks.length)];
            const randomDate = getRandomDate();

            await pool.query(
                'INSERT INTO whatsapp_feedbacks (mobile_no, feedback, created_at) VALUES (?, ?, ?)',
                [randomMobile, randomFeedback, randomDate]
            );

            console.log(`Inserted feedback ${i + 1} of 150`);
        }

        console.log('Successfully inserted 150 dummy feedbacks');
        process.exit(0);
    } catch (error) {
        console.error('Error inserting dummy data:', error);
        process.exit(1);
    }
}

insertDummyFeedbacks();
