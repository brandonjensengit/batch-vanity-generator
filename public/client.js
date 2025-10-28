// public/client.js
const socket = io(); // Connect to the server

// Form elements
const form = document.getElementById('configForm');
const prefixInput = document.getElementById('prefix');
const suffixInput = document.getElementById('suffix');
const includesInput = document.getElementById('includes');
const caseSensitiveInput = document.getElementById('caseSensitive');
const countInput = document.getElementById('count');
const threadsInput = document.getElementById('threads');
const outputModeSelect = document.getElementById('outputMode');
const containerNamesInput = document.getElementById('containerNames');
const approversPerContainerInput = document.getElementById('approversPerContainer');
const omnibusOptionsDiv = document.getElementById('omnibusOptions');
const containerOptionsDiv = document.getElementById('containerOptions');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const outputPre = document.getElementById('output');
const downloadBtn = document.getElementById('downloadBtn'); // Get download button

let isGenerating = false;
let foundCounter = 0;

// --- Output Mode Change Handler ---
function updateOptionsVisibility() {
    const mode = outputModeSelect.value;

    // Hide all mode-specific options first
    omnibusOptionsDiv.style.display = 'none';
    containerOptionsDiv.style.display = 'none';

    // Show relevant options based on mode
    if (mode === 'omnibus') {
        omnibusOptionsDiv.style.display = 'block';
        countInput.disabled = true; // Disable count input for omnibus mode
    } else if (mode.startsWith('containers')) {
        containerOptionsDiv.style.display = 'block';
        countInput.disabled = true; // Disable count input for containers mode
    } else {
        countInput.disabled = false; // Enable count input for other modes
    }
}

// Initialize visibility on page load
updateOptionsVisibility();

// Add event listener for output mode changes
outputModeSelect.addEventListener('change', updateOptionsVisibility);

// --- Form Submission ---
form.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent page reload

    if (isGenerating) return;

    const outputMode = outputModeSelect.value;

    const config = {
        desiredPrefix: prefixInput.value.trim() || null,
        desiredSuffix: suffixInput.value.trim() || null,
        desiredIncludes: includesInput.value.trim() || null,
        caseSensitive: caseSensitiveInput.checked,
        numberOfAddressesToFind: parseInt(countInput.value, 10),
        numberOfThreads: parseInt(threadsInput.value, 10),
        outputMode: outputMode
    };

    // Add container-specific settings if in containers mode
    if (outputMode.startsWith('containers')) {
        const containerNames = containerNamesInput.value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        config.containerNames = containerNames;
        config.approversPerContainer = parseInt(approversPerContainerInput.value, 10);
    }

    if (!config.numberOfThreads || config.numberOfThreads < 1) {
         alert("Please enter a valid number of threads."); return;
    }

    // For omnibus and containers modes, numberOfAddressesToFind is calculated by server
    if (outputMode !== 'omnibus' && !outputMode.startsWith('containers')) {
        if (!config.numberOfAddressesToFind || config.numberOfAddressesToFind < 1) {
            alert("Please enter a valid number of addresses to find.");
            return;
        }
    }

    console.log('Sending config:', config);
    socket.emit('startGeneration', config);

    // Update UI for starting
    isGenerating = true;
    foundCounter = 0;
    latestFormattedOutput = null; // Clear previous formatted output
    latestOutputMode = null;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    downloadBtn.disabled = true; // Disable download button on new generation start
    outputPre.textContent = ''; // Clear previous output
    statusDiv.textContent = 'Status: Requesting start...';
});

// --- Stop Button ---
stopBtn.addEventListener('click', () => {
    if (!isGenerating) return;
    console.log('Requesting stop...');
    socket.emit('stopGeneration');
    statusDiv.textContent = 'Status: Requesting stop...';
});

// --- Download Button ---
downloadBtn.addEventListener('click', () => {
    let fileContent = "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = `vanity_keys_${timestamp}.txt`;
    let mimeType = 'text/plain;charset=utf-8';

    // If we have formatted output (omnibus or containers mode), use that
    if (latestFormattedOutput) {
        fileContent = latestFormattedOutput;

        // Set appropriate file extension and mime type
        if (latestOutputMode && latestOutputMode.includes('json')) {
            filename = `vanity_keys_${timestamp}.json`;
            mimeType = 'application/json;charset=utf-8';
        } else if (latestOutputMode && latestOutputMode.includes('csv')) {
            filename = `vanity_keys_${timestamp}.csv`;
            mimeType = 'text/csv;charset=utf-8';
        }
    } else {
        // Fallback: build content from displayed key pairs
        const keyPairDivs = outputPre.querySelectorAll('.key-pair');

        if (keyPairDivs.length === 0) {
            alert('Nothing to download!');
            return;
        }

        keyPairDivs.forEach((div, index) => {
            const addressSpan = div.querySelector('span:first-child');
            const keySpan = div.querySelector('span:last-child');

            if (addressSpan && keySpan) {
                fileContent += addressSpan.textContent + "\n";
                fileContent += keySpan.textContent + "\n";

                if (index < keyPairDivs.length - 1) {
                    fileContent += "\n";
                }
            }
        });
    }

    if (!fileContent) {
        alert('Nothing to download!');
        return;
    }

    // Create and trigger download
    try {
        const blob = new Blob([fileContent], { type: mimeType });
        const link = document.createElement('a');

        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(link.href); // Clean up

    } catch (error) {
        console.error("Error creating download link:", error);
        alert("Could not create download file.");
    }
});


// --- Socket Event Listeners ---
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    statusDiv.textContent = 'Status: Connected. Ready to start.';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server.');
    statusDiv.textContent = 'Status: Disconnected from server.';
    isGenerating = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // Keep download button state as is - user might still want to download existing content
});

socket.on('statusUpdate', (message) => {
    console.log('Status:', message);
    statusDiv.textContent = `Status: ${message}`;
});

socket.on('foundKey', (data) => {
    foundCounter++;
    console.log('Found key:', data);

    // Enable download button when the first key is found
    if (foundCounter === 1) {
        downloadBtn.disabled = false;
    }

    const keyPairDiv = document.createElement('div');
    keyPairDiv.classList.add('key-pair');

    const addressSpan = document.createElement('span');
    addressSpan.textContent = `Address: ${data.address}`;

    const keySpan = document.createElement('span');
    keySpan.textContent = `Private Key: ${data.privateKey}`;

    keyPairDiv.appendChild(addressSpan);
    keyPairDiv.appendChild(keySpan);

    outputPre.appendChild(keyPairDiv);
    outputPre.scrollTop = outputPre.scrollHeight; // Auto-scroll

    statusDiv.textContent = `Status: Found ${foundCounter} address(es)... Searching...`;
});

socket.on('generationComplete', () => {
    console.log('Generation complete.');
    statusDiv.textContent = `Status: Generation Complete (${foundCounter} found).`;
    isGenerating = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // Keep download button enabled if there's content
    if (foundCounter === 0) {
         downloadBtn.disabled = true;
    }
});

socket.on('generationStopped', () => {
    console.log('Generation stopped.');
     if (isGenerating) {
        statusDiv.textContent = 'Status: Generation Stopped.';
     }
    isGenerating = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
     // Keep download button enabled if there's content
     if (foundCounter === 0) {
         downloadBtn.disabled = true;
    }
});

// Store the latest formatted output for download
let latestFormattedOutput = null;
let latestOutputMode = null;

socket.on('formattedOutput', (data) => {
    console.log('Received formatted output:', data.mode, 'Count:', data.count);

    // Store for download
    latestFormattedOutput = data.content;
    latestOutputMode = data.mode;

    // Enable download button when we have content
    if (data.content && data.content.length > 0) {
        downloadBtn.disabled = false;
    }

    // For omnibus and containers modes, display the formatted output instead of individual keys
    if (data.mode === 'omnibus' || data.mode.startsWith('containers')) {
        outputPre.textContent = data.content;
        outputPre.scrollTop = outputPre.scrollHeight; // Auto-scroll to bottom
    }
});