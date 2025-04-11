// public/client.js
const socket = io(); // Connect to the server

// Form elements
const form = document.getElementById('configForm');
const prefixInput = document.getElementById('prefix');
const suffixInput = document.getElementById('suffix'); // <-- ADD THIS LINE
const includesInput = document.getElementById('includes');
const caseSensitiveInput = document.getElementById('caseSensitive');
const countInput = document.getElementById('count');
const threadsInput = document.getElementById('threads');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const outputPre = document.getElementById('output');
const downloadBtn = document.getElementById('downloadBtn');
const revealBtn = document.getElementById('revealBtn');

let isGenerating = false;
let foundCounter = 0;
let generatedKeys = []; // Array to store keys before revealing

// --- Form Submission (RESET LOGIC ADDED) ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isGenerating) return;

    const config = {
        desiredPrefix: prefixInput.value.trim() || null,
        desiredSuffix: suffixInput.value.trim() || null,
        desiredIncludes: includesInput.value.trim() || null,
        caseSensitive: caseSensitiveInput.checked,
        numberOfAddressesToFind: parseInt(countInput.value, 10),
        numberOfThreads: parseInt(threadsInput.value, 10)
    };

    if (!config.numberOfAddressesToFind || config.numberOfAddressesToFind < 1) {
         alert("Please enter a valid number of addresses to find."); return;
    }
     if (!config.numberOfThreads || config.numberOfThreads < 1) {
         alert("Please enter a valid number of threads."); return;
    }

    console.log('Sending config:', config);
    socket.emit('startGeneration', config);

    // --- Reset UI for new generation ---
    isGenerating = true;
    foundCounter = 0;
    generatedKeys = []; // Clear stored keys
    startBtn.disabled = true;
    stopBtn.disabled = false;
    downloadBtn.disabled = true; // Disable download button
    revealBtn.style.display = 'none'; // Hide reveal button
    outputPre.textContent = ''; // Clear previous output
    outputPre.style.display = 'none'; // Hide output area
    statusDiv.textContent = 'Status: Requesting start...';
    statusDiv.style.display = 'block'; // Ensure status is visible
});

// --- Stop Button (No Change) ---
stopBtn.addEventListener('click', () => {
    if (!isGenerating) return;
    console.log('Requesting stop...');
    socket.emit('stopGeneration');
    statusDiv.textContent = 'Status: Requesting stop...';
});

// --- Download Button (No Change in listener logic, but enabling is moved) ---
downloadBtn.addEventListener('click', () => {
    let fileContent = "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vanity_keys_${timestamp}.txt`;

    // Build content directly from the displayed #output (only possible AFTER reveal)
    const keyPairDivs = outputPre.querySelectorAll('.key-pair');
    if (keyPairDivs.length === 0) {
        alert('Nothing to download!'); // Should not happen if button is enabled correctly
        return;
    }

    keyPairDivs.forEach((div, index) => {
        const addressSpan = div.querySelector('span:first-child');
        const keySpan = div.querySelector('span:last-child');
        if (addressSpan && keySpan) {
            fileContent += addressSpan.textContent + "\n";
            fileContent += keySpan.textContent + "\n";
            if (index < keyPairDivs.length - 1) {
                fileContent += "\n"; // Add blank line separator
            }
        }
    });

    try {
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = filename; link.style.display = 'none';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Error creating download link:", error); alert("Could not create download file.");
    }
});

// --- Reveal Button Listener ---
revealBtn.addEventListener('click', () => {
    // Clear any previous content just in case
    outputPre.textContent = '';

    // Populate the output area from the stored keys
    generatedKeys.forEach(data => {
        const keyPairDiv = document.createElement('div');
        keyPairDiv.classList.add('key-pair');

        const addressSpan = document.createElement('span');
        addressSpan.textContent = `Address: ${data.address}`;

        const keySpan = document.createElement('span');
        keySpan.textContent = `Private Key: ${data.privateKey}`; // Use stored key

        keyPairDiv.appendChild(addressSpan);
        keyPairDiv.appendChild(keySpan);
        outputPre.appendChild(keyPairDiv);
    });

    // Show the output area
    outputPre.style.display = 'block';
    // Hide the reveal button itself
    revealBtn.style.display = 'none';
    // Enable the download button now
    if (generatedKeys.length > 0) {
        downloadBtn.disabled = false;
    }
});


// --- Socket Event Listeners ---
socket.on('connect', () => { /* ... no change ... */ });
socket.on('disconnect', () => { /* ... no change ... */ });
socket.on('statusUpdate', (message) => { /* ... no change ... */ });

// MODIFIED: Store keys instead of displaying immediately
socket.on('foundKey', (data) => {
    foundCounter++;
    console.log('Stored key:', data.address); // Log address only for privacy
    generatedKeys.push(data); // Store the key pair data

    // Don't enable download button here
    // Don't append to outputPre here

    statusDiv.textContent = `Status: Found ${foundCounter} address(es)... Searching...`;
});

// MODIFIED: Show Reveal button on completion
socket.on('generationComplete', () => {
    console.log('Generation complete.');
    statusDiv.textContent = `Status: Generation Complete (${foundCounter} found).`;
    isGenerating = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Trigger confetti
    if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }

    // Show REVEAL button if keys were found
    if (foundCounter > 0) {
        revealBtn.style.display = 'inline-block'; // Show the reveal button
        revealBtn.disabled = false;
        // Keep download button disabled until keys are revealed
        downloadBtn.disabled = true;
    } else {
        // No keys found, ensure buttons are in correct state
        revealBtn.style.display = 'none';
        downloadBtn.disabled = true;
    }
});

// MODIFIED: Ensure reveal button is hidden on stop
socket.on('generationStopped', () => {
    console.log('Generation stopped.');
    if (isGenerating) { // Only update status if it wasn't already 'Complete'
       statusDiv.textContent = 'Status: Generation Stopped.';
    }
    isGenerating = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Show REVEAL button if keys were found before stopping
    if (foundCounter > 0) {
        revealBtn.style.display = 'inline-block';
        revealBtn.disabled = false;
        downloadBtn.disabled = true; // Keep download disabled
    } else {
        revealBtn.style.display = 'none';
        downloadBtn.disabled = true;
    }
});