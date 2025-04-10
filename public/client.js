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
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const outputPre = document.getElementById('output');
const downloadBtn = document.getElementById('downloadBtn'); // Get download button

let isGenerating = false;
let foundCounter = 0;

// --- Form Submission ---
form.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent page reload

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

    // Update UI for starting
    isGenerating = true;
    foundCounter = 0;
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
    let fileContent = ""; // String to build file content
    const keyPairDivs = outputPre.querySelectorAll('.key-pair'); // Get all result divs
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vanity_keys_${timestamp}.txt`;

    if (keyPairDivs.length === 0) {
        alert('Nothing to download!');
        return;
    }

    // Iterate through each key pair div displayed on the page
    keyPairDivs.forEach((div, index) => {
        const addressSpan = div.querySelector('span:first-child');
        const keySpan = div.querySelector('span:last-child');

        if (addressSpan && keySpan) {
            // Append "Address: ..." line
            fileContent += addressSpan.textContent + "\n";
            // Append "Private Key: ..." line
            fileContent += keySpan.textContent + "\n";

            // Add separator after each pair (except the last one)
            if (index < keyPairDivs.length - 1) {
                // --- CHOOSE ONE SEPARATOR OPTION ---
                // Option 1: Add an extra blank line
                fileContent += "\n";

                // Option 2: Add a separator line (like '---')
                // fileContent += "---\n\n";
                // --- END CHOOSE ---
            }
        }
    });

    // Create and trigger download link using the constructed fileContent string
    try {
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
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