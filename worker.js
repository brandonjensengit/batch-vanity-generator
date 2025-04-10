// worker.js
const { parentPort, workerData } = require('worker_threads');
const ethers = require('ethers'); // Worker needs its own instance

const {
    desiredPrefix,
    desiredSuffix,
    desiredIncludes,
    caseSensitive
} = workerData; // Get config from main thread

// --- Helper Function for Pattern Matching (in worker) ---
function checkVanityMatchWorker(address) {
    const compareAddress = caseSensitive ? address : address.toLowerCase();
    // Normalize patterns based on case sensitivity *once*
    const comparePrefix = caseSensitive ? desiredPrefix : (desiredPrefix ? desiredPrefix.toLowerCase() : null);
    const compareSuffix = caseSensitive ? desiredSuffix : (desiredSuffix ? desiredSuffix.toLowerCase() : null);
    const compareIncludes = caseSensitive ? desiredIncludes : (desiredIncludes ? desiredIncludes.toLowerCase() : null);

    let prefixMatch = true;
    if (comparePrefix) {
        prefixMatch = compareAddress.startsWith(comparePrefix);
    }
    if (!prefixMatch) return false;

    let suffixMatch = true;
    if (compareSuffix) {
        suffixMatch = compareAddress.endsWith(compareSuffix);
    }
    if (!suffixMatch) return false;

    let includesMatch = true;
    if (compareIncludes) {
        const searchStr = caseSensitive ? address.substring(2) : address.substring(2).toLowerCase();
        const includesPattern = caseSensitive ? compareIncludes : compareIncludes.toLowerCase();
         includesMatch = searchStr.includes(includesPattern);
    }

    return includesMatch;
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