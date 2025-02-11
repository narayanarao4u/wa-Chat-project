const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

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