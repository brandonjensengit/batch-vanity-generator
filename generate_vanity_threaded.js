const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// --- Configuration ---

// Define your desired vanity pattern(s)
const desiredPrefix = null;    // Address should start with this (e.g., '0xbad', '0xace') - Leave null if not needed
const desiredSuffix = null;       // Address should end with this (e.g., 'dead', 'babe') - Leave null if not needed
const desiredIncludes = null;   // Address should include this anywhere (e.g., 'dad', 'c0ffee') - Leave null if not needed

const caseSensitive = true;      // Set to true for exact case matching, false for case-insensitive

const numberOfAddressesToFind = 5; // How many vanity addresses do you want to generate?
const numberOfThreads = 10;        // How many CPU threads to use for searching

const outputFile = 'vanity_wallets_threaded.txt'; // File to save the results (set to null to only print)

// --- End Configuration ---

// --- Main Thread Logic ---
if (isMainThread) {
    console.log(`Starting vanity address generation with ${numberOfThreads} threads...`);
    console.log(` - Target Count: ${numberOfAddressesToFind}`);
    if (desiredPrefix) console.log(` - Requiring Prefix: ${desiredPrefix} (${caseSensitive ? 'Case-Sensitive' : 'Case-Insensitive'})`);
    if (desiredSuffix) console.log(` - Requiring Suffix: ${desiredSuffix} (${caseSensitive ? 'Case-Sensitive' : 'Case-Insensitive'})`);
    if (desiredIncludes) console.log(` - Requiring Includes: ${desiredIncludes} (${caseSensitive ? 'Case-Sensitive' : 'Case-Insensitive'})`);
    if (outputFile) console.log(` - Saving results to: ${outputFile}`);
    console.log("---"); // Separator kept for structure


    console.log("Vanity Key Generation:");
    console.log(""); // Add a blank line after the header for spacing

    let foundCount = 0;
    const workers = [];

    // Prepare file stream if saving to file
    if (outputFile) {
        try {
            fs.writeFileSync(outputFile, `--- Vanity Wallet Generation Results (Threaded) ---\n`);
            fs.appendFileSync(outputFile, `Generated At: ${new Date().toISOString()}\n`); // Using current date: 2025-04-10
            fs.appendFileSync(outputFile, `Threads: ${numberOfThreads}, Case-Sensitive: ${caseSensitive}\n`);
            fs.appendFileSync(outputFile, `Prefix: ${desiredPrefix || 'N/A'}, Suffix: ${desiredSuffix || 'N/A'}, Includes: ${desiredIncludes || 'N/A'}\n`);
            // --- Removed Security Header Line From File ---
            fs.appendFileSync(outputFile, `\n`); // Keep a blank line for separation before results
        } catch (err) {
            console.error(`🛑 FATAL: Could not write to output file ${outputFile}. Aborting.`, err);
            process.exit(1);
        }
    }

    const terminateAllWorkers = () => {
        console.log(`---`);
        console.log(`Target count reached (${foundCount}). Terminating workers...`);
        workers.forEach(worker => worker.terminate());
        setTimeout(() => {
             console.log(`✅ Successfully generated ${foundCount} vanity address(es).`);
             if (outputFile) {
                 // --- Removed Security Reminder From This Line ---
                console.log(`Results saved to ${outputFile}.`);
             }
             // process.exit(0); // Optional: force exit
         }, 1000);
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
                const result = {
                    count: foundCount,
                    address: message.address,
                    privateKey: message.privateKey,
                };

                // Console Output
                console.log(`Address: ${result.address}`);
                console.log(`Private Key: ${result.privateKey}`);
                console.log(""); // Blank line separator

                // File Output
                if (outputFile) {
                    const fileEntry = `Address: ${result.address}\nPrivate Key: ${result.privateKey}\n\n`;
                    try {
                        fs.appendFileSync(outputFile, fileEntry);
                    } catch (err) {
                        console.error(`\n🛑 Error writing to file ${outputFile}:`, err);
                        console.error(`🛑 Wallet details (PLEASE RECORD SECURELY): Address=${result.address}, PrivateKey=${result.privateKey}`);
                        // terminateAllWorkers(); // Decide whether to stop on error
                    }
                }

                if (foundCount >= numberOfAddressesToFind) {
                    terminateAllWorkers();
                }
            }
        });

        worker.on('error', (error) => {
            console.error(`🛑 Error in Worker ${i + 1}:`, error);
        });

        worker.on('exit', (code) => {
            const index = workers.indexOf(worker);
            if(index > -1) workers.splice(index, 1);
             if (workers.length === 0 && foundCount < numberOfAddressesToFind && !(process.exitCode || process.killed)) {
                 console.log("---");
                 console.warn(`⚠️ All workers exited, but only found ${foundCount}/${numberOfAddressesToFind} addresses.`);
                 if (outputFile) {
                     // --- Removed Security Reminder From This Line ---
                     console.log(`Partial results may be in ${outputFile}.`);
                 }
             }
        });

        workers.push(worker);
    }

}
// --- Worker Thread Logic (No changes needed) ---
else {
    const ethersWorker = require('ethers');

    const {
        desiredPrefix,
        desiredSuffix,
        desiredIncludes,
        caseSensitive
    } = workerData;

    function checkVanityMatchWorker(address) {
        const compareAddress = caseSensitive ? address : address.toLowerCase();
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

    while (true) {
        const wallet = ethersWorker.Wallet.createRandom();
        const address = wallet.address;

        if (checkVanityMatchWorker(address)) {
            parentPort.postMessage({
                address: address,
                privateKey: wallet.privateKey
            });
        }
    }
}