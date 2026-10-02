// SVG Constant for Convert Arrows
const convertArrowsSvg = `<svg class="custom-convert-arrows-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><path fill="none" d="M0 0h24v24H0z"></path><path d="M12 8H8.001L8 20H6V8H2l5-5 5 5zm10 8l-5 5-5-5h4V4h2v12h4z"></path></g></g></svg>`;

// State Variables
let currentTypedAmount = "0";
const usdtPriceInInr = 96.225; // INR conversion rate matching screenshot
let userUsdtBalance = 2.00;   // Default balance

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

// Scanner Modal Elements
const scannerModal = document.getElementById('scannerModal');
const closeScannerBtn = document.getElementById('closeScannerBtn');

// Toast Elements
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    autoDetectTrustWalletAndFetchBalance();
});

function setupEventListeners() {
    // Address Input Event
    addressInput.addEventListener('input', () => {
        const addr = addressInput.value.trim();
        if (addr.length === 42 && addr.startsWith('0x')) {
            fetchRealUsdtBalance(addr);
        }
    });

    // Clear Address Button
    clearBtn.addEventListener('click', () => {
        addressInput.value = '';
        addressInput.focus();
    });

    // Continue Button on Screen 1 -> Opens Screen 2 (Amount Screen)
    continueBtn.addEventListener('click', () => {
        const addr = addressInput.value.trim();
        if (!addr) {
            showToast('Please enter a valid receiver address');
            addressInput.focus();
            return;
        }

        // Pass Address to Screen 2
        displayToAddress.textContent = addr;

        // Transition Screen 1 -> Screen 2
        stepAddress.classList.remove('active');
        stepAmount.classList.add('active');
    });

    // Back Arrow on Screen 2 -> Returns to Screen 1
    backToAddressBtn.addEventListener('click', () => {
        stepAmount.classList.remove('active');
        stepAddress.classList.add('active');
    });

    // Keypad Logic
    keypadBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            if (btn.id === 'keypadDelete') {
                handleBackspace();
            } else if (key) {
                handleKeyInput(key);
            }
        });
    });

    // Max Button Click
    maxBtn.addEventListener('click', () => {
        currentTypedAmount = userUsdtBalance.toString();
        updateAmountDisplay();
    });

    // Review Button on Screen 2 -> Opens Screen 3 (Review Send Screen)
    reviewBtn.addEventListener('click', () => {
        const amt = parseFloat(currentTypedAmount);
        const addr = addressInput.value.trim();

        if (isNaN(amt) || amt <= 0) {
            showToast('Please enter an amount greater than 0');
            return;
        }

        // Populate Screen 3 (Review Send)
        reviewCryptoVal.textContent = `${amt} USDT`;
        const fiatNum = (amt * usdtPriceInInr).toFixed(2);
        reviewFiatVal.textContent = `≈ ₹${fiatNum}`;
        reviewToAddress.textContent = addr;

        // Populate Wallet Name
        const walletNameEl = document.querySelector('.detail-val-text');
        if (walletNameEl) {
            walletNameEl.textContent = detectWalletName();
        }

        // Transition Screen 2 -> Screen 3
        stepAmount.classList.remove('active');
        stepReview.classList.add('active');
    });

    // Back Arrow on Screen 3 -> Returns to Screen 2
    backToAmountBtn.addEventListener('click', () => {
        stepReview.classList.remove('active');
        stepAmount.classList.add('active');
    });

    // Send Button on Screen 3 -> Connects Wallet & Triggers Web3 USDT Transfer
    sendBtn.addEventListener('click', () => {
        executeSendTransaction();
    });

    // Open/Close Scanner Modal
    scanQrBtn.addEventListener('click', () => {
        scannerModal.classList.add('show');
    });

    closeScannerBtn.addEventListener('click', () => {
        scannerModal.classList.remove('show');
    });

    scannerModal.addEventListener('click', (e) => {
        if (e.target === scannerModal) {
            scannerModal.classList.remove('show');
        }
    });

    // Top Close Button
    closeBtn.addEventListener('click', () => {
        addressInput.value = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        currentTypedAmount = '0';
        updateAmountDisplay();
    });
}

/**
 * Connects Web3 Wallet and Triggers USDT BEP-20 Transfer
 */
async function executeSendTransaction() {
    const amt = parseFloat(currentTypedAmount);
    const receiverAddr = addressInput.value.trim();

    if (isNaN(amt) || amt <= 0) {
        showToast('Please enter a valid amount');
        return;
    }

    if (!receiverAddr || !receiverAddr.startsWith('0x') || receiverAddr.length !== 42) {
        showToast('Please enter a valid BEP-20 address');
        return;
    }

    // 1. If Web3 Provider (Trust Wallet / MetaMask) is injected in browser
    if (typeof window.ethereum !== 'undefined') {
        try {
            showToast('Connecting wallet...');

            // Connect Wallet
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts || accounts.length === 0) {
                showToast('Wallet connection rejected');
                return;
            }

            const senderAddr = accounts[0];

            // Switch to BNB Smart Chain Network
            await switchToBscChain();

            // Calculate Amount in Wei (18 decimals for USDT on BSC)
            const amountBigInt = BigInt(Math.floor(amt * 1e18));
            const amountHex = '0x' + amountBigInt.toString(16);

            // Construct ERC-20 / BEP-20 transfer(address to, uint256 value) data
            const cleanReceiver = receiverAddr.substring(2).padStart(64, '0');
            const cleanAmount = amountHex.substring(2).padStart(64, '0');
            const transferData = '0xa9059cbb' + cleanReceiver + cleanAmount; // 0xa9059cbb is transfer(address,uint256) selector

            showToast('Please confirm transaction in your wallet');

            // Prompt Transaction confirmation in Trust Wallet
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: senderAddr,
                    to: '0x55d398326f99059ff775485246999027b3197955', // USDT BEP-20 Contract
                    data: transferData,
                    value: '0x0'
                }]
            });

            if (txHash) {
                showToast('Transaction submitted successfully!');
            }
        } catch (err) {
            console.error('Send Transaction Error:', err);
            if (err && err.code === 4001) {
                showToast('Transaction cancelled by user');
            } else {
                triggerDeepLinkFallback(receiverAddr, amt);
            }
        }
    } else {
        // Fallback for standard mobile browsers outside dApp browser
        triggerDeepLinkFallback(receiverAddr, amt);
    }
}

// Switch to BSC Network Helper
async function switchToBscChain() {
    if (!window.ethereum) return;
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x38' }] // 56 in Hex
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
            } catch (addErr) {
                console.error('BSC add network error:', addErr);
            }
        }
    }
}

// Fallback Deep Link Launcher
function triggerDeepLinkFallback(receiverAddr, amt) {
    const deepLink = `ethereum:0x55d398326f99059ff775485246999027b3197955@56/transfer?address=${receiverAddr}&uint256=${amt * 1e18}`;
    copyToClipboard(receiverAddr, 'Opening Trust Wallet...');
    setTimeout(() => {
        window.location.href = deepLink;
    }, 500);
}

/**
 * Detects Wallet Name strictly returning "Main Wallet"
 */
function detectWalletName() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('wallet')) {
        return urlParams.get('wallet');
    }
    return "Main Wallet";
}

/**
 * Auto Detect Trust Wallet DApp Browser Provider
 */
async function autoDetectTrustWalletAndFetchBalance() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            let activeAddr = null;

            if (accounts && accounts.length > 0) {
                activeAddr = accounts[0];
            } else {
                const reqAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (reqAccounts && reqAccounts.length > 0) {
                    activeAddr = reqAccounts[0];
                }
            }

            if (activeAddr) {
                fetchRealUsdtBalance(activeAddr);
            } else {
                fetchRealUsdtBalance(getCurrentAddress());
            }
        } catch (e) {
            console.log('Trust Wallet Auto Detect Info:', e);
            fetchRealUsdtBalance(getCurrentAddress());
        }
    } else {
        fetchRealUsdtBalance(getCurrentAddress());
    }
}

/**
 * Fetches REAL Live USDT Balance on BNB Smart Chain via RPC
 */
async function fetchRealUsdtBalance(walletAddress) {
    if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) return;

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
                params: [
                    {
                        to: '0x55d398326f99059ff775485246999027b3197955',
                        data: data
                    },
                    'latest'
                ]
            })
        });

        const json = await response.json();
        if (json.result && json.result !== '0x') {
            const rawBalanceHex = json.result;
            const rawBalanceBigInt = BigInt(rawBalanceHex);
            const balanceUsdt = Number(rawBalanceBigInt) / 1e18;

            userUsdtBalance = balanceUsdt;
            updateBalanceUI(balanceUsdt);
        }
    } catch (err) {
        console.warn('RPC Balance Fetch Note:', err);
    }
}

// Update Balance UI
function updateBalanceUI(usdtAmount) {
    const formattedCrypto = usdtAmount.toFixed(2) + ' USDT';
    const inrValue = (usdtAmount * usdtPriceInInr).toFixed(2);
    const formattedFiat = '₹' + inrValue;

    const tokenBalanceCryptoEl = document.querySelector('.token-balance-crypto');
    const tokenBalanceFiatEl = document.querySelector('.token-balance-fiat');

    if (tokenBalanceCryptoEl) tokenBalanceCryptoEl.textContent = formattedCrypto;
    if (tokenBalanceFiatEl) tokenBalanceFiatEl.textContent = formattedFiat;
}

// Get current trimmed address
function getCurrentAddress() {
    const val = addressInput.value.trim();
    return val !== '' ? val : '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
}

// Handle Keypad Number / Decimal Input
function handleKeyInput(key) {
    if (key === '.') {
        if (!currentTypedAmount.includes('.')) {
            currentTypedAmount += '.';
        }
    } else {
        if (currentTypedAmount === '0') {
            currentTypedAmount = key;
        } else {
            if (currentTypedAmount.length < 8) {
                currentTypedAmount += key;
            }
        }
    }
    updateAmountDisplay();
}

// Handle Backspace Key
function handleBackspace() {
    if (currentTypedAmount.length > 1) {
        currentTypedAmount = currentTypedAmount.slice(0, -1);
    } else {
        currentTypedAmount = '0';
    }
    updateAmountDisplay();
}

// Update Big Display Amount & Review Button State
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
            const inrVal = (val * usdtPriceInInr).toFixed(2);
            displayFiatVal.innerHTML = `≈ ₹${inrVal} ${convertArrowsSvg}`;

            reviewBtn.classList.remove('btn-review-disabled');
            reviewBtn.classList.add('btn-review-active');
        }
    }
}

// Copy Helper
function copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
    }).catch(() => {
        showToast('Failed to copy');
    });
}

// Show Toast Notification
function showToast(message) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}
