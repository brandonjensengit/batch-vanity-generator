// worker.js
const { parentPort, workerData } = require('worker_threads');
const ethers = require('ethers'); // Worker needs its own instance

const {
    desiredPrefix,
    desiredSuffix,
    desiredIncludes,
    caseSensitive
} = workerData; // Get config from main thread

// Normalize patterns once per worker; strip leading '0x' if provided
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
    // Compare against the body (no '0x') for all pattern types
    const body = address.slice(2);
    const compareBody = caseSensitive ? body : body.toLowerCase();

    if (normPrefix && !compareBody.startsWith(normPrefix)) return false;
    if (normSuffix && !compareBody.endsWith(normSuffix)) return false;
    if (normIncludes && !compareBody.includes(normIncludes)) return false;

    return true;
}

// --- Generation Loop (in worker) ---
try {
    while (true) {
        const wallet = ethers.Wallet.createRandom();
        const address = wallet.address;

        if (checkVanityMatchWorker(address)) {
            // Get the private key with prefix
            const privateKeyWithPrefix = wallet.privateKey;
            // Remove the '0x' prefix
            const privateKeyWithoutPrefix = privateKeyWithPrefix.slice(2);

            // Found a match, send it back to the main thread with the correct format
            parentPort.postMessage({
                type: 'found',
                data: {
                    address: address, // Address is correct
                    privateKey: privateKeyWithoutPrefix // Send the key without '0x'
                }
            });
        }
    }
} catch (error) {
     parentPort.postMessage({ type: 'error', error: error.message || 'Unknown worker error' });
}