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

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // --- Handle Start Request from Client ---
    socket.on('startGeneration', (config) => {
        console.log(`Received start request from ${socket.id} with config:`, config);

        // Stop any previous generation for this client first
        stopClientWorkers(socket.id);

        const threads = parseInt(config.numberOfThreads, 10) || 1;
        const targetCount = parseInt(config.numberOfAddressesToFind, 10) || 1;
        let foundCount = 0;
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
                    foundCount++;
                    console.log(`Worker found key for ${socket.id}: ${message.data.address}`);
                    // Send found key back to this specific client
                    socket.emit('foundKey', {
                        address: message.data.address,
                        privateKey: message.data.privateKey
                    });

                    // Check if target count reached
                    if (foundCount >= targetCount) {
                        socket.emit('statusUpdate', `Target count (${targetCount}) reached.`);
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
        return true; // Indicate that workers were stopped
    }
    return false; // Indicate no workers were running for this client
}

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});