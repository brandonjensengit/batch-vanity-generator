const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

// --- ENCRYPTION CONSTANTS (must match generate_secure.js) ---
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');
}

/**
 * Decrypt data with AES-256-GCM
 */
function decrypt(encryptedData, password) {
    try {
        const buffer = Buffer.from(encryptedData, 'base64');

        // Extract components
        const salt = buffer.slice(0, SALT_LENGTH);
        const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = buffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = buffer.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

        // Derive key
        const key = deriveKey(password, salt);

        // Decrypt
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        // Clear sensitive data
        key.fill(0);

        return decrypted;
    } catch (error) {
        throw new Error('Decryption failed. Incorrect password or corrupted file.');
    }
}

/**
 * Prompt for password securely (hidden input)
 */
function promptPassword(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

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

// --- Main ---
(async () => {
    console.log('\n🔓 SECURE WALLET DECRYPTION TOOL 🔓\n');

    // Get filename from command line or prompt
    let filename = process.argv[2];

    if (!filename) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        filename = await new Promise((resolve) => {
            rl.question('Enter encrypted file path: ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

    // Check if file exists
    if (!fs.existsSync(filename)) {
        console.error(`❌ Error: File not found: ${filename}`);
        process.exit(1);
    }

    // Read encrypted data
    console.log(`📂 Reading encrypted file: ${filename}\n`);
    const encryptedData = fs.readFileSync(filename, 'utf8');

    // Prompt for password
    const password = await promptPassword('Enter decryption password: ');
    console.log('');

    // Decrypt
    try {
        const decrypted = decrypt(encryptedData, password);
        const data = JSON.parse(decrypted);

        console.log('✅ Decryption successful!\n');
        console.log('='.repeat(80));
        console.log('DECRYPTED WALLET DATA');
        console.log('='.repeat(80));
        console.log(`Generated: ${data.generated}`);
        console.log(`Total Addresses: ${data.count}\n`);

        data.addresses.forEach((wallet, index) => {
            console.log(`Address ${index + 1}:`);
            console.log(`  Address:     ${wallet.address}`);
            console.log(`  Private Key: ${wallet.privateKey}\n`);
        });

        console.log('='.repeat(80));
        console.log('\n⚠️  WARNING: Keep these private keys secure!');
        console.log('⚠️  Never share them with anyone.');
        console.log('⚠️  Store them in a secure location.\n');

    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
    }
})();
