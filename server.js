// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { Worker } = require('worker_threads');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active workers associated with client sockets
const activeWorkers = new Map(); // Map<socketId, Worker[]>
const clientSessions = new Map(); // Map<socketId, { results: Array<{address:string, privateKey:string}>, foundCount:number, targetCount:number, outputMode:string }>

const DEFAULT_CONTAINERS = ['Omnibus', 'Investigation', 'Garbage', 'Firm Wallet'];
const DEFAULT_APPROVERS_PER_CONTAINER = 5; // results in 10 keys per container (Signer + Emergency per approver)

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // --- Handle Start Request from Client ---
    socket.on('startGeneration', (config) => {
        console.log(`Received start request from ${socket.id} with config:`, config);

        // Stop any previous generation for this client first
        stopClientWorkers(socket.id);

        const threads = parseInt(config.numberOfThreads, 10) || 1;
        let targetCount = parseInt(config.numberOfAddressesToFind, 10) || 1;
        const outputMode = (config.outputMode || 'csv').toString();

        // Omnibus mode detection (40 addresses: 4 sets × 5 approvers × 2 keys)
        const isOmnibusMode = (outputMode.toLowerCase() === 'omnibus') || !!config.omnibusMode;

        // Container mode detection & parameters
        const isContainersMode = (outputMode.toLowerCase().startsWith('containers')) || !!config.containerMode;
        const containers = Array.isArray(config.containerNames) && config.containerNames.length
          ? config.containerNames.map(String)
          : DEFAULT_CONTAINERS.slice();
        const approversPerContainer = parseInt(config.approversPerContainer, 10) || DEFAULT_APPROVERS_PER_CONTAINER;

        if (isOmnibusMode) {
          // Omnibus: 4 sets × 5 approvers × 2 keys each = 40 addresses
          targetCount = 40;
        } else if (isContainersMode) {
          // Each approver needs 2 keys (Signer + Emergency)
          targetCount = containers.length * approversPerContainer * 2;
        }

        const session = {
          results: [],
          foundCount: 0,
          targetCount,
          outputMode,
          isOmnibusMode,
          isContainersMode,
          containers,
          approversPerContainer,
        };
        clientSessions.set(socket.id, session);

        const workers = [];
        activeWorkers.set(socket.id, workers); // Store workers for this client

        socket.emit('statusUpdate', `Starting search for ${targetCount} address(es) with ${threads} threads...`);

        for (let i = 0; i < threads; i++) {
            const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
                workerData: {
                    // Pass only necessary config to worker
                    desiredPrefix: config.desiredPrefix || null,
                    desiredSuffix: config.desiredSuffix || null,
                    desiredIncludes: config.desiredIncludes || null,
                    caseSensitive: config.caseSensitive || false,
                }
            });

            worker.on('message', (message) => {
                // Check if this client's generation is still active
                if (!activeWorkers.has(socket.id)) return; // Generation was stopped

                if (message.type === 'found') {
                    const sess = clientSessions.get(socket.id);
                    if (!sess) return;

                    sess.foundCount++;
                    sess.results.push({
                        address: message.data.address,
                        privateKey: message.data.privateKey
                    });

                    console.log(`Worker found key for ${socket.id}: ${message.data.address}`);
                    // Send found key back to this specific client
                    socket.emit('foundKey', {
                        address: message.data.address,
                        privateKey: message.data.privateKey
                    });

                    // Build formatted output blob for client convenience
                    let formatted, mimeType;
                    if (sess.isOmnibusMode) {
                      formatted = formatOmnibus(sess.results);
                      mimeType = getMimeTypeForMode(sess.outputMode);
                    } else if (sess.isContainersMode) {
                      formatted = formatContainers(sess.results, sess.outputMode, sess.containers, sess.approversPerContainer);
                      mimeType = getMimeTypeForMode(sess.outputMode);
                    } else {
                      formatted = formatResults(sess.results, sess.outputMode);
                      mimeType = getMimeTypeForMode(sess.outputMode);
                    }

                    socket.emit('formattedOutput', {
                      mode: sess.outputMode,
                      mimeType,
                      content: formatted,
                      count: sess.results.length,
                    });

                    // Check if target count reached
                    if (sess.foundCount >= sess.targetCount) {
                        socket.emit('statusUpdate', `Target count (${sess.targetCount}) reached.`);
                        socket.emit('generationComplete');
                        stopClientWorkers(socket.id); // Stop all workers for this client
                    }
                } else if (message.type === 'error') {
                     console.error(`Worker error for ${socket.id}:`, message.error);
                     socket.emit('statusUpdate', `Error occurred: ${message.error}`);
                     stopClientWorkers(socket.id);
                }
            });

            worker.on('error', (error) => {
                console.error(`Worker uncaught error for ${socket.id}:`, error);
                 if (activeWorkers.has(socket.id)) { // Only emit if still relevant
                    socket.emit('statusUpdate', `A critical worker error occurred: ${error.message}`);
                    stopClientWorkers(socket.id);
                 }
            });

            worker.on('exit', (code) => {
                // console.log(`Worker exited with code ${code} for client ${socket.id}`);
                // Clean up exited worker reference if needed (stopClientWorkers handles termination)
            });

            workers.push(worker); // Add to this client's list
        } // end worker creation loop

    }); // end socket.on('startGeneration')

    // --- Handle Stop Request from Client ---
    socket.on('stopGeneration', () => {
        console.log(`Received stop request from ${socket.id}`);
        if (stopClientWorkers(socket.id)) {
            socket.emit('statusUpdate', 'Generation stopped by user.');
            socket.emit('generationStopped');
        }
    });

    // --- Handle Client Disconnection ---
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        stopClientWorkers(socket.id); // Clean up resources if client disconnects
    });

}); // end io.on('connection')

// Helper function to stop and cleanup workers for a specific client
function stopClientWorkers(socketId) {
    const workers = activeWorkers.get(socketId);
    if (workers && workers.length > 0) {
        console.log(`Terminating ${workers.length} workers for ${socketId}`);
        workers.forEach(worker => worker.terminate());
        activeWorkers.delete(socketId); // Remove client from active map
        clientSessions.delete(socketId); // Remove session info as well
        return true; // Indicate that workers were stopped
    }
    return false; // Indicate no workers were running for this client
}

function formatResults(results, mode) {
    // Existing formatting helper (assumed to exist)
    // Placeholder implementation:
    if ((mode || '').toLowerCase() === 'json') {
        return JSON.stringify(results, null, 2);
    }
    if ((mode || '').toLowerCase() === 'csv') {
        const header = 'address,privateKey';
        const rows = results.map(r => `${r.address},${r.privateKey}`);
        return [header, ...rows].join('\n');
    }
    // Default pretty print
    return results.map(r => `Address: ${r.address}\nPrivateKey: ${r.privateKey}`).join('\n\n');
}

function getMimeTypeForMode(mode) {
  const m = (mode || 'csv').toLowerCase();
  switch (m) {
    case 'json':
    case 'containers-json':
      return 'application/json';
    case 'csv':
    case 'containers-csv':
      return 'text/csv';
    case 'omnibus':
    case 'addresses':
    case 'pretty':
    case 'containers':
    case 'containers-pretty':
    default:
      return 'text/plain';
  }
}

function buildContainerAssignments(results, containers, approversPerContainer) {
  const assignments = [];
  let idx = 0;
  for (const container of containers) {
    const approvers = [];
    for (let i = 1; i <= approversPerContainer; i++) {
      const signer = results[idx++] || { address: '', privateKey: '' };
      const emergency = results[idx++] || { address: '', privateKey: '' };
      approvers.push({
        label: `Approver-${i}`,
        signer,
        emergency,
      });
    }
    assignments.push({ container, approvers });
  }
  return assignments;
}

function formatOmnibus(results) {
  // Format for 40 addresses: 4 sets × 5 approvers × 2 keys each
  const sets = ['Omnibus', 'Investigation', 'Garbage', 'Firm Wallet'];
  const approversPerSet = 5;
  const lines = [];
  let idx = 0;

  for (const setName of sets) {
    lines.push(setName);
    lines.push('='.repeat(setName.length)); // Underline with equals signs
    lines.push(''); // Blank line after header

    for (let i = 1; i <= approversPerSet; i++) {
      const approverKey = results[idx++] || { address: '', privateKey: '' };
      const emergencyKey = results[idx++] || { address: '', privateKey: '' };

      lines.push(`  Approver-${i}:`);
      lines.push(`    Approver Key:  ${approverKey.address}, ${approverKey.privateKey}`);
      lines.push(`    Emergency Key: ${emergencyKey.address}, ${emergencyKey.privateKey}`);
      lines.push(''); // Blank line between approvers
    }

    lines.push(''); // Extra blank line between sets
  }

  return lines.join('\n');
}

function formatContainers(results, mode, containers, approversPerContainer) {
  const assignments = buildContainerAssignments(results, containers, approversPerContainer);
  const m = (mode || '').toLowerCase();
  if (m === 'containers-json') {
    return JSON.stringify(assignments, null, 2);
  }
  if (m === 'containers-csv') {
    // container,approver,role,address,privateKey
    const header = 'container,approver,role,address,privateKey';
    const rows = [];
    for (const item of assignments) {
      for (const a of item.approvers) {
        rows.push(`${item.container},${a.label},Signer,${a.signer.address},${a.signer.privateKey}`);
        rows.push(`${item.container},${a.label},Emergency,${a.emergency.address},${a.emergency.privateKey}`);
      }
    }
    return [header, ...rows].join('\n');
  }
  // Default: pretty text (also used for 'containers' and 'containers-pretty')
  const lines = [];
  lines.push(`There are ${approversPerContainer} approvers`);
  for (const item of assignments) {
    lines.push('');
    lines.push(`${item.container} Container`);
    for (const a of item.approvers) {
      lines.push(a.label);
      lines.push('');
      lines.push('Signer Key');
      lines.push(`Address: ${a.signer.address}`);
      lines.push(`Private Key: ${a.signer.privateKey}`);
      lines.push('');
      lines.push('Emergency Key');
      lines.push(`Address: ${a.emergency.address}`);
      lines.push(`Private Key: ${a.emergency.privateKey}`);
      lines.push('\n' + '-'.repeat(24));
    }
  }
  return lines.join('\n');
}

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});