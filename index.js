const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });
const db = require('./database');
const qrcode = require('qrcode');

// Add body parser middleware
app.use(express.urlencoded({ extended: true }));

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

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

// Add this function after addMessage function
const saveFeedback = async (mobileNo, feedback) => {
    try {
        await db.saveFeedback(mobileNo, feedback);
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

// Add this function after the saveFeedback function
const isWhatsAppNumber = async (number) => {    
    
    try {
        const formattedNumber = '91' + number + '@c.us';
        const isRegistered = await client.isRegisteredUser(formattedNumber);
        return isRegistered;
    } catch (error) {
        console.error(`Error checking WhatsApp number ${number}:`, error);
        return false;
    }
};



// Generate QR Code
client.on('qr', async (qr) => {
    try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        io.emit('qr', qrDataUrl);
        console.log('QR code generated');
    } catch (error) {
        console.error('QR generation error:', error);
    }
});

// When client is ready
client.on('ready', () => {
    console.log('Client is ready!');
    client.getState().then(async () => {
        const info = await client.info;
        io.emit('client-ready', info.wid.user); // Send phone number to client
    });
});

// Listen for messages
client.on('message', async (message) => {
    addMessage(message);
    const content = message.body.toLowerCase();
    const from = message.from.replace('@c.us', '').slice(2); // Remove '91' prefix and '@c.us'

    // Check if this is a feedback response
    if (content !== 'hi' && content !== 'hello' && content !== 'time' && 
        content !== 'help' && content !== 'bill25' && !content.startsWith('hi ')) {
        
        const result = await saveFeedback(from, message.body);
        if (result.success) {
            const reply = 'Thank you for your feedback. We appreciate your response.';
            await message.reply(reply);
            addMessage(reply, true);
        } else {
            console.log(`Feedback not saved: ${result.message} for number ${from}`);
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

// Also modify the send-message route to include validation
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    try {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        
        // Check if it's a valid WhatsApp number
        const isValid = await isWhatsAppNumber(cleanPhone);
       
        
        if (!isValid) {
            throw new Error('Not a valid WhatsApp number');
        }

        const formattedPhone = cleanPhone + '@c.us';
        await client.sendMessage(formattedPhone, message);
        
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
        console.log('Error sending message:', error);
        res.render('send-message', {
            status: {
                type: 'error',
                message: error.message === 'Not a valid WhatsApp number' 
                    ? 'Invalid WhatsApp number. Please check the number and try again.'
                    : 'Failed to send message. Please check the phone number and try again.'
            }
        });
    }
});

// Add new routes before app.listen
app.get('/upload', (req, res) => {
    res.render('upload-csv');
});

// Modify the upload-csv route to include WhatsApp number validation
app.post('/upload-csv', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

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
                        // Check if it's a valid WhatsApp number
                        const isValid = await isWhatsAppNumber(mobileNo);
                        
                        if (!isValid) {
                            console.log(`Not a valid WhatsApp number: ${mobileNo}`);
                            continue;
                        }

                        // Save to database and send message only if it's a valid WhatsApp number
                        await db.addCustomer(mobileNo, landlineNo, isValid);
                        const formattedPhone = '91' + mobileNo + '@c.us';
                        const message = `

Your landline No ${landlineNo} is disconnected recently. 
Please share your reasons for disconnection to help us provide better service.
  1. excess billing issue
  2. poor service quality
  3. other reasons

                        `;
                        
                        try {
                            await client.sendMessage(formattedPhone, message);
                            addMessage({
                                from: 'CSV Bulk Sender',
                                body: `[To: ${mobileNo}] ${message}`
                            });
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (error) {
                            console.error(`Failed to send message to ${mobileNo}:`, error);
                        }
                    }
                }
                
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
        const feedbacks = await db.getFeedbacks();
        res.render('feedbacks', { feedbacks });
    } catch (error) {
        console.error('Error reading feedbacks:', error);
        res.status(500).send('Error loading feedbacks');
    }
});

// Fix the reports route
app.get('/reports', async (req, res) => {
    try {
        const stats = await db.getFeedbackStats(); // Changed from dbOps to db
        res.render('reports', { stats: JSON.stringify(stats) });
    } catch (error) {
        console.error('Error rendering reports:', error);
        res.status(500).send('Error generating reports');
    }
});

// Add this route before other routes
app.get('/login', (req, res) => {
    res.render('qr-login');
});

// Web routes
app.get('/', (req, res) => {
    res.render('chat', { messages: messages });
});

// Add Socket.IO event handlers after io initialization
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('check-status', async () => {
        const state = await client.getState();
        if (state === 'CONNECTED') {
            const info = await client.info;
            socket.emit('client-ready', info.wid.user);
        }
    });

    socket.on('logout-whatsapp', async () => {
        try {
            await client.logout();
            socket.emit('logout-complete');
            console.log('WhatsApp logout successful');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = 3010;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Initialize the client
client.initialize();