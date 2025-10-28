const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

// --- SECURE CONFIGURATION ---
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// --- Configuration ---
let desiredPrefix = null;
let desiredSuffix = null;
let desiredIncludes = null;
let caseSensitive = false;
let numberOfAddressesToFind = 5;
let numberOfThreads = 10;
let outputMode = 'memory'; // 'memory' or 'encrypted'
let password = null;

// --- Security Functions ---

/**
 * Securely clear a string from memory by overwriting it
 */
function secureClear(str) {
    if (typeof str !== 'string') return;
    // Overwrite the string in memory
    for (let i = 0; i < str.length; i++) {
        str = str.substring(0, i) + '\0' + str.substring(i + 1);
    }
}

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');
}

/**
 * Encrypt data with AES-256-GCM
 */
function encrypt(plaintext, password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted data
    const result = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
    ]);

    // Clear sensitive data
    key.fill(0);

    return result.toString('base64');
}

/**
 * Create readline interface for secure password input
 */
function createReadlineInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

/**
 * Prompt for password securely (hidden input)
 */
function promptPassword(prompt) {
    return new Promise((resolve) => {
        const rl = createReadlineInterface();

        // Hide password input
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        let password = '';

        process.stdout.write(prompt);

        stdin.on('data', (char) => {
            char = char.toString();

            switch (char) {
                case '\n':
                case '\r':
                case '\u0004': // Ctrl-D
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.removeAllListeners('data');
                    process.stdout.write('\n');
                    rl.close();
                    resolve(password);
                    break;
                case '\u0003': // Ctrl-C
                    process.exit(0);
                    break;
                case '\u007f': // Backspace
                    password = password.slice(0, -1);
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    process.stdout.write(prompt + '*'.repeat(password.length));
                    break;
                default:
                    password += char;
                    process.stdout.write('*');
                    break;
            }
        });
    });
}

/**
 * Prompt for user input
 */
function promptInput(question) {
    return new Promise((resolve) => {
        const rl = createReadlineInterface();
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * Validate password strength
 */
function validatePassword(password) {
    if (password.length < 12) {
        return { valid: false, message: 'Password must be at least 12 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character' };
    }
    return { valid: true };
}

// --- Main Thread Logic ---
if (isMainThread) {
    console.log('\n🔐 SECURE ETHEREUM VANITY ADDRESS GENERATOR 🔐\n');
    console.log('This tool generates Ethereum addresses with enhanced security.\n');

    (async () => {
        try {
            // Get configuration from user
            console.log('=== Configuration ===\n');

            const prefix = await promptInput('Desired prefix (optional, press Enter to skip): ');
            if (prefix.trim()) desiredPrefix = prefix.trim();

            const suffix = await promptInput('Desired suffix (optional, press Enter to skip): ');
            if (suffix.trim()) desiredSuffix = suffix.trim();

            const includes = await promptInput('Must include (optional, press Enter to skip): ');
            if (includes.trim()) desiredIncludes = includes.trim();

            const caseAnswer = await promptInput('Case sensitive? (y/n, default: n): ');
            caseSensitive = caseAnswer.toLowerCase() === 'y';

            const countAnswer = await promptInput('Number of addresses to generate (default: 5): ');
            if (countAnswer.trim()) numberOfAddressesToFind = parseInt(countAnswer, 10);

            const threadsAnswer = await promptInput('Number of threads (default: 10): ');
            if (threadsAnswer.trim()) numberOfThreads = parseInt(threadsAnswer, 10);

            console.log('\n=== Output Mode ===\n');
            console.log('1. In-Memory Only (Display in terminal, no disk writes) - MOST SECURE');
            console.log('2. Encrypted File (AES-256-GCM encrypted output file)\n');

            const modeAnswer = await promptInput('Select mode (1 or 2, default: 1): ');
            outputMode = modeAnswer.trim() === '2' ? 'encrypted' : 'memory';

            if (outputMode === 'encrypted') {
                console.log('\n=== Password Setup ===\n');
                console.log('Password Requirements:');
                console.log('- Minimum 12 characters');
                console.log('- At least one uppercase letter');
                console.log('- At least one lowercase letter');
                console.log('- At least one number');
                console.log('- At least one special character\n');

                let passwordValid = false;
                while (!passwordValid) {
                    password = await promptPassword('Enter encryption password: ');
                    const validation = validatePassword(password);

                    if (validation.valid) {
                        const confirmPassword = await promptPassword('Confirm encryption password: ');
                        if (password === confirmPassword) {
                            passwordValid = true;
                            secureClear(confirmPassword);
                        } else {
                            console.log('❌ Passwords do not match. Please try again.\n');
                            secureClear(confirmPassword);
                        }
                    } else {
                        console.log(`❌ ${validation.message}\n`);
                    }
                }
                console.log('✅ Password set successfully.\n');
            }

            console.log('\n=== Starting Generation ===\n');
            console.log(`Target Count: ${numberOfAddressesToFind}`);
            if (desiredPrefix) console.log(`Prefix: ${desiredPrefix}`);
            if (desiredSuffix) console.log(`Suffix: ${desiredSuffix}`);
            if (desiredIncludes) console.log(`Includes: ${desiredIncludes}`);
            console.log(`Case Sensitive: ${caseSensitive}`);
            console.log(`Threads: ${numberOfThreads}`);
            console.log(`Output Mode: ${outputMode === 'memory' ? 'In-Memory Only' : 'Encrypted File'}`);
            console.log('\nGenerating addresses...\n');

            let foundCount = 0;
            const workers = [];
            const results = [];

            const terminateAllWorkers = () => {
                workers.forEach(worker => worker.terminate());
                setTimeout(() => {
                    displayResults(results);
                }, 100);
            };

            // Create workers
            for (let i = 0; i < numberOfThreads; i++) {
                const worker = new Worker(__filename, {
                    workerData: {
                        desiredPrefix,
                        desiredSuffix,
                        desiredIncludes,
                        caseSensitive
                    }
                });

                worker.on('message', (message) => {
                    if (foundCount < numberOfAddressesToFind) {
                        foundCount++;
                        results.push({
                            address: message.address,
                            privateKey: message.privateKey
                        });

                        console.log(`✅ Found ${foundCount}/${numberOfAddressesToFind}: ${message.address}`);

                        if (foundCount >= numberOfAddressesToFind) {
                            terminateAllWorkers();
                        }
                    }
                });

                worker.on('error', (error) => {
                    console.error(`❌ Worker error:`, error);
                });

                workers.push(worker);
            }

            function displayResults(results) {
                console.log('\n' + '='.repeat(80));
                console.log('GENERATION COMPLETE');
                console.log('='.repeat(80) + '\n');

                if (outputMode === 'memory') {
                    console.log('⚠️  SECURITY WARNING: These keys are displayed ONCE. Copy them now!\n');
                    console.log('📋 GENERATED ADDRESSES:\n');

                    results.forEach((result, index) => {
                        console.log(`Address ${index + 1}:`);
                        console.log(`  Address:     ${result.address}`);
                        console.log(`  Private Key: ${result.privateKey}\n`);
                    });

                    console.log('⚠️  These keys will NOT be saved to disk.');
                    console.log('⚠️  Copy them to a secure location NOW.\n');

                    // Clear sensitive data from memory after a delay
                    setTimeout(() => {
                        results.forEach(result => {
                            secureClear(result.privateKey);
                            secureClear(result.address);
                        });
                        console.log('🔒 Sensitive data has been cleared from memory.');
                        process.exit(0);
                    }, 60000); // 60 seconds to copy

                    console.log('Press Ctrl+C when done copying (auto-clear in 60 seconds)...');

                } else if (outputMode === 'encrypted') {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `secure_wallets_${timestamp}.enc`;

                    // Format data as JSON
                    const data = JSON.stringify({
                        generated: new Date().toISOString(),
                        count: results.length,
                        addresses: results
                    }, null, 2);

                    // Encrypt data
                    const encrypted = encrypt(data, password);

                    // Write encrypted file
                    fs.writeFileSync(filename, encrypted);

                    console.log(`✅ Encrypted file saved: ${filename}`);
                    console.log(`\n📝 To decrypt, run: node decrypt_keys.js ${filename}\n`);

                    // Clear sensitive data
                    results.forEach(result => {
                        secureClear(result.privateKey);
                        secureClear(result.address);
                    });
                    secureClear(password);

                    console.log('🔒 Sensitive data has been cleared from memory.');
                    process.exit(0);
                }
            }

        } catch (error) {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        }
    })();

} else {
    // Worker Thread Logic (same as before)
    const ethers = require('ethers');

    const {
        desiredPrefix,
        desiredSuffix,
        desiredIncludes,
        caseSensitive
    } = workerData;

    function normalizePattern(p) {
        if (!p && p !== 0) return null;
        let s = String(p).trim();
        if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
        return caseSensitive ? s : s.toLowerCase();
    }

    const normPrefix = normalizePattern(desiredPrefix);
    const normSuffix = normalizePattern(desiredSuffix);
    const normIncludes = normalizePattern(desiredIncludes);

    function checkVanityMatchWorker(address) {
        const body = address.slice(2);
        const compareBody = caseSensitive ? body : body.toLowerCase();

        if (normPrefix && !compareBody.startsWith(normPrefix)) return false;
        if (normSuffix && !compareBody.endsWith(normSuffix)) return false;
        if (normIncludes && !compareBody.includes(normIncludes)) return false;

        return true;
    }

    try {
        while (true) {
            const wallet = ethers.Wallet.createRandom();
            const address = wallet.address;

            if (checkVanityMatchWorker(address)) {
                const privateKeyWithPrefix = wallet.privateKey;
                const privateKeyWithoutPrefix = privateKeyWithPrefix.slice(2);

                parentPort.postMessage({
                    address: address,
                    privateKey: privateKeyWithoutPrefix
                });
            }
        }
    } catch (error) {
        parentPort.postMessage({ type: 'error', error: error.message || 'Unknown worker error' });
    }
}
