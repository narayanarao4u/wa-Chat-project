const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const upload = multer({ dest: 'uploads/' });

// Add body parser middleware
app.use(express.urlencoded({ extended: true }));

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Store messages
const messages = [];

// Add this function after const messages = [];
const addMessage = (message, isBot = false) => {
    const messageData = {
        from: isBot ? 'Bot' : message.from,
        body: typeof message === 'string' ? message : message.body,
        timestamp: new Date().toLocaleString(),
        isBot
    };
    messages.push(messageData);
    io.emit('new-message', messageData);
};

// Add after other const declarations
const FEEDBACK_FILE = 'feedback.csv';

// Initialize feedback CSV if it doesn't exist
if (!fs.existsSync(FEEDBACK_FILE)) {
    const writer = csvWriter({ headers: ['timestamp', 'mobileNo', 'landlineNo', 'feedback']});
    writer.pipe(fs.createWriteStream(FEEDBACK_FILE));
    writer.end();
}

// Add this function after addMessage function
const saveFeedback = async (mobileNo, feedback) => {
    try {
        // Read the original CSV to find the landline number
        const results = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream('uploads/last_upload.csv')
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        // Find matching mobile number
        const record = results.find(row => row.mobileNo.trim() === mobileNo);
        const landlineNo = record ? record.landlineNo : 'Unknown';

        // Append to feedback CSV
        const writer = csvWriter({sendHeaders: false});
        writer.pipe(fs.createWriteStream(FEEDBACK_FILE, {flags: 'a'}));
        writer.write({
            timestamp: new Date().toISOString(),
            mobileNo,
            landlineNo,
            feedback
        });
        writer.end();

        return true;
    } catch (error) {
        console.error('Error saving feedback:', error);
        return false;
    }
};

// Create a new WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth()
});

// Generate QR Code
client.on('qr', (qr) => {
    console.log('Scan this QR code with your WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// When client is ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Listen for messages
client.on('message', async (message) => {
    addMessage(message);
    const content = message.body.toLowerCase();
    const from = message.from.replace('@c.us', '').slice(2); // Remove '91' prefix and '@c.us'

    // Check if this is a feedback response
    if (content !== 'hi' && content !== 'hello' && content !== 'time' && 
        content !== 'help' && content !== 'bill25' && !content.startsWith('hi ')) {
        
        const saved = await saveFeedback(from, message.body);
        if (saved) {
            const reply = 'Thank you for your feedback. We appreciate your response.';
            await message.reply(reply);
            addMessage(reply, true);
        }
    }

    if (content.startsWith('hi ')) {
        const nameOrPhone = message.body.slice(3).trim();
        const reply = `👋 Hello ${nameOrPhone}! Nice to meet you!`;
        await message.reply(reply);
        addMessage(reply, true);
    }
    else if (content === 'bill25') {
        try {
            const media = MessageMedia.fromFilePath(path.join(__dirname, 'billno25.pdf'));
            await message.reply(media, undefined, { caption: 'Here is your Bill No. 25' });
            addMessage('Here is your Bill No. 25 [PDF file attached]', true);
        } catch (error) {
            const reply = 'Sorry, I could not find the requested bill.';
            await message.reply(reply);
            addMessage(reply, true);
        }
    }
    else if (content === 'hello' || content === 'hi') {
        const reply = '👋 Hello! How can I help you today?';
        await message.reply(reply);
        addMessage(reply, true);
    }
    else if (content === 'time') {
        const reply = `The current time is: ${new Date().toLocaleTimeString()}`;
        await message.reply(reply);
        addMessage(reply, true);
    }
    else if (content === 'help') {
        const reply = `Available commands:
- hello/hi: Get a greeting
- hi <name/phone>: Get a personalized greeting
- time: Get current time
- bill25: Get Bill No. 25 PDF
- help: Show this help message`;
        await message.reply(reply);
        addMessage(reply, true);
    }
});

// Add new routes
app.get('/send', (req, res) => {
    res.render('send-message', { status: null });
});

app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    try {
        // Format the phone number
        const formattedPhone = phone.replace(/[^\d]/g, '') + '@c.us';
        
        // Send the message
        await client.sendMessage(formattedPhone, message);
        
        // Add to message history
        addMessage({
            from: 'Web Interface',
            body: `[To: ${phone}] ${message}`
        });

        res.render('send-message', {
            status: {
                type: 'success',
                message: 'Message sent successfully!'
            }
        });
    } catch (error) {
        res.render('send-message', {
            status: {
                type: 'error',
                message: 'Failed to send message. Please check the phone number and try again.'
            }
        });
    }
});

// Add new routes before app.listen
app.get('/upload', (req, res) => {
    res.render('upload-csv');
});

app.post('/upload-csv', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    // Save a copy of the uploaded CSV
    fs.copyFileSync(req.file.path, 'uploads/last_upload.csv');

    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                // Process each row
                for (const row of results) {
                    const mobileNo = row.mobileNo.trim();
                    const landlineNo = row.landlineNo.trim();
                    
                    if (mobileNo && mobileNo.length === 10) {
                        const formattedPhone = '91' + mobileNo + '@c.us';
                        const message = `Your landline No ${landlineNo} is disconnected recently. Please share your reasons for disconnection to help us provide better service.`;
                        
                        try {
                            await client.sendMessage(formattedPhone, message);
                            addMessage({
                                from: 'CSV Bulk Sender',
                                body: `[To: ${mobileNo}] ${message}`
                            });
                            // Add delay to prevent flooding
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (error) {
                            console.error(`Failed to send message to ${mobileNo}:`, error);
                        }
                    }
                }
                
                // Clean up uploaded file
                fs.unlinkSync(req.file.path);
                
                res.redirect('/');
            } catch (error) {
                console.error('Error processing CSV:', error);
                res.status(500).send('Error processing CSV file');
            }
        });
});

// Add new route before app.listen
app.get('/feedbacks', async (req, res) => {
    try {
        const feedbacks = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(FEEDBACK_FILE)
                .pipe(csv())
                .on('data', (data) => feedbacks.push(data))
                .on('end', resolve)
                .on('error', reject);
        });
        
        res.render('feedbacks', { feedbacks: feedbacks.reverse() }); // Show newest first
    } catch (error) {
        console.error('Error reading feedbacks:', error);
        res.status(500).send('Error loading feedbacks');
    }
});

// Web routes
app.get('/', (req, res) => {
    res.render('chat', { messages: messages });
});

// Start server
const PORT = 3010;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize the client
client.initialize();