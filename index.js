const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

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
    const content = message.body.toLowerCase();

    // Check for hi with phone or name pattern
    if (content.startsWith('hi ')) {
        const nameOrPhone = message.body.slice(3).trim(); // Remove 'hi ' and trim spaces
        await message.reply(`👋 Hello ${nameOrPhone}! Nice to meet you!`);
    }
    // Handle bill25 request
    else if (content === 'bill25') {
        try {
            const media = MessageMedia.fromFilePath(path.join(__dirname, 'billno25.pdf'));
            await message.reply(media, undefined, { caption: 'Here is your Bill No. 25' });
        } catch (error) {
            await message.reply('Sorry, I could not find the requested bill.');
        }
    }
    // Simple response system
    else if (content === 'hello' || content === 'hi') {
        await message.reply('👋 Hello! How can I help you today?');
    }
    else if (content === 'time') {
        await message.reply(`The current time is: ${new Date().toLocaleTimeString()}`);
    }
    else if (content === 'help') {
        await message.reply(`
Available commands:
- hello/hi: Get a greeting
- hi <name/phone>: Get a personalized greeting
- time: Get current time
- bill25: Get Bill No. 25 PDF
- help: Show this help message`);
    }
});

// Initialize the client
client.initialize();