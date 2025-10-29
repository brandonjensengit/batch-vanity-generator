# Batch Vanity Address Generator

A high-performance, multi-threaded Ethereum vanity address generator with a web-based interface. Generate custom Ethereum addresses matching specific patterns, with support for multiple output formats including a specialized deployment set format for multi-signature wallet setups.

## Features

- **Multi-threaded Generation**: Leverages Node.js worker threads for optimal performance
- **Real-time Web Interface**: Monitor generation progress with live updates via Socket.IO
- **Multiple Output Formats**:
  - CSV (address, privateKey)
  - JSON
  - Pretty text
  - Deployment Set (40 addresses organized for multi-sig deployments)
  - Custom Containers (configurable sets)
- **Vanity Pattern Matching**:
  - Prefix matching (e.g., addresses starting with `0xdead`)
  - Suffix matching (e.g., addresses ending with `beef`)
  - Contains matching (e.g., addresses containing `c0ffee`)
  - Case-sensitive or case-insensitive options
- **Download Results**: Export generated addresses in various formats
- **Command Line Interface**: Scriptable generation via CLI tool

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/brandonjensengit/batch-vanity-generator.git
cd batch-vanity-generator
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Web Interface

1. Start the server:
```bash
node server.js
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Configure your generation settings:
   - **Vanity Pattern**: Optional prefix, suffix, or contains pattern
   - **Case Sensitive**: Toggle exact case matching
   - **Number of Addresses**: How many addresses to generate (ignored for contract deployment sets)
   - **Threads**: Number of CPU threads to use (recommend 10-16 for best performance)
   - **Output Format**: Choose from available formats

4. Click "Start Generation" and watch the addresses appear in real-time

5. Use "Download Results" to save your generated addresses

### Command Line Interface

#### Standard CLI (Basic)

Edit the configuration in `generate_vanity_threaded.js`:

```javascript
const desiredPrefix = '0xdead';    // Address starts with this
const desiredSuffix = 'beef';       // Address ends with this
const desiredIncludes = 'c0ffee';   // Address contains this
const caseSensitive = false;        // Case-insensitive matching
const numberOfAddressesToFind = 5;  // Generate 5 addresses
const numberOfThreads = 10;         // Use 10 threads
const outputFile = 'vanity_wallets_threaded.txt'; // Save to file
```

Then run:
```bash
node generate_vanity_threaded.js
```

#### Secure CLI (Recommended for Production)

For maximum security, use the secure CLI mode with encryption and in-memory options:

```bash
node generate_secure.js
```

This interactive tool will guide you through:
1. Configuring vanity pattern matching
2. Choosing output mode:
   - **In-Memory Only (MOST SECURE)**: Keys displayed once in terminal, never written to disk
   - **Encrypted File**: Keys saved with AES-256-GCM encryption, password-protected

**Decrypting saved files:**
```bash
node decrypt_keys.js secure_wallets_2024-01-01.enc
```

## Output Formats

### Deployment Set Format

Generates exactly **40 Ethereum addresses** organized into 4 sets, perfect for multi-signature wallet deployments:

```
Contract Type 1
=======

  Approver-1:
    Approver Key:  0x1234...abcd, 5678...efgh
    Emergency Key: 0x9012...ijkl, 3456...mnop

  Approver-2:
    ...

Contract Type 2
=============

  Approver-1:
    ...

Contract Type 3
=======

  Approver-1:
    ...

Contract Type 4
===========

  Approver-1:
    ...
```

Each set contains:
- **5 Approvers**
- **2 Keys per approver** (Approver Key + Emergency Key)
- **Total: 40 addresses** (4 sets × 5 approvers × 2 keys)

### Container Format

Similar to Deployment Set but with customizable container names and approver counts. Configure via the web interface.

### CSV Format

```csv
address,privateKey
0x1234567890abcdef1234567890abcdef12345678,abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
0x9876543210fedcba9876543210fedcba98765432,1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd
```

### JSON Format

```json
[
  {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "privateKey": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  },
  {
    "address": "0x9876543210fedcba9876543210fedcba98765432",
    "privateKey": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd"
  }
]
```

## Performance Tips

- **Thread Count**: Use 10-16 threads for optimal performance on most systems
- **Pattern Complexity**: Shorter patterns are found faster
  - `0xdead` - Fast (4 hex characters)
  - `0xdeadbeef` - Slower (8 hex characters)
  - `0xdeadbeefcafe` - Very slow (12 hex characters)
- **Case Sensitivity**: Case-insensitive mode is approximately 16x faster than case-sensitive
- **Multiple Patterns**: Using prefix + suffix + contains will significantly increase search time

## Security Warning

⚠️ **IMPORTANT SECURITY CONSIDERATIONS:**

### Security Levels

This tool provides multiple security levels:

| Method | Security Level | Best For |
|--------|---------------|----------|
| **Secure CLI - In-Memory Mode** | 🔒🔒🔒🔒🔒 HIGHEST | Production wallets, cold storage |
| **Secure CLI - Encrypted File** | 🔒🔒🔒🔒 HIGH | Long-term storage with password protection |
| **Standard CLI** | 🔒🔒🔒 MEDIUM | Testing, development |
| **Web Interface** | 🔒🔒 LOW | Testing only, trusted network |

### Best Practices

1. **For Maximum Security (Production Wallets)**:
   - Use `node generate_secure.js` with **In-Memory Only** mode
   - Run on an **air-gapped machine** (completely offline)
   - Write down keys on paper, never digital storage
   - Verify keys work by importing to a test wallet first
   - Store paper backups in multiple secure locations (safe, bank vault)

2. **Using Encrypted File Mode**:
   - Use a **strong password** (12+ characters, mixed case, numbers, symbols)
   - Store password separately from encrypted file
   - Decrypt only when needed on a secure machine
   - Delete decrypted output immediately after use
   - Consider using a hardware security module (HSM) for password storage

3. **Private Key Security**:
   - Never share private keys with anyone
   - Never transmit keys over the internet (email, chat, cloud storage)
   - Never screenshot or photograph private keys
   - Clear clipboard after copying keys
   - Be aware of shoulder surfing (people looking at your screen)

4. **Network Security**:
   - **NEVER** expose the web interface to the public internet
   - Only run on `localhost` (127.0.0.1)
   - Use a firewall to block external access to port 3000
   - Disconnect from the internet when generating production keys

5. **File Security**:
   - Output files (`.txt`, `.csv`, `.json`) contain unencrypted private keys
   - Delete all output files using secure deletion tools:
     - macOS: `srm filename.txt` (install with `brew install srm`)
     - Linux: `shred -u filename.txt`
     - Windows: Use secure deletion software
   - Never commit private key files to version control
   - Encrypted files (`.enc`) are safe to store but require password

6. **Air-Gapped Generation (Maximum Security)**:
   - Install Node.js and dependencies on an offline computer
   - Transfer code via USB (scan for malware first)
   - Generate keys completely offline
   - Transfer only **public addresses** (never private keys) when going online

7. **Randomness & Cryptographic Security**:
   - This tool uses Node.js `crypto.randomBytes()` for secure randomness
   - ethers.js library provides cryptographically secure wallet generation
   - Generated addresses are suitable for production use
   - Verify randomness source is working: check `/dev/urandom` (Linux/Mac)

8. **Browser Security (Web Interface)**:
   - Browser cache is disabled for sensitive data
   - Private keys displayed in DOM are still visible in browser memory
   - Use browser private/incognito mode
   - Close browser completely after use
   - Clear browser history and cache after generation

9. **Physical Security**:
   - Ensure no cameras can see your screen
   - Check for keyloggers or screen recorders
   - Use a clean, malware-free computer
   - Consider using a dedicated computer for key generation

10. **Testing Before Production**:
    - Always test with small amounts first
    - Verify you can import and access generated wallets
    - Confirm backup/recovery process works
    - Use testnet addresses for practice

## Architecture

### Components

- **`server.js`**: Express server with Socket.IO for the web interface
- **`worker.js`**: Worker thread implementation for parallel address generation
- **`generate_vanity_threaded.js`**: Standalone CLI tool for batch generation
- **`public/`**: Web interface assets (HTML, CSS, JavaScript)

### How It Works

1. Main thread spawns multiple worker threads
2. Each worker generates random Ethereum addresses
3. Workers check if addresses match the specified pattern
4. Matching addresses are sent back to the main thread
5. Results are displayed in real-time and can be downloaded

## Configuration Options

### Web Interface Options

| Option | Description |
|--------|-------------|
| Prefix | Pattern that address must start with (e.g., `0xdead`) |
| Suffix | Pattern that address must end with (e.g., `beef`) |
| Includes | Pattern that address must contain (e.g., `c0ffee`) |
| Case Sensitive | Match exact case vs. case-insensitive |
| Number of Addresses | How many addresses to generate |
| Threads | Number of worker threads (1-32) |
| Output Format | CSV, JSON, Pretty, Deployment Set, or Containers |

### Environment Variables

- `PORT`: Server port (default: 3000)

## Troubleshooting

### Generation is slow
- Reduce pattern complexity
- Use case-insensitive matching
- Increase thread count (up to your CPU core count)

### Out of memory errors
- Reduce thread count
- Generate addresses in smaller batches

### Server won't start
- Check if port 3000 is already in use
- Try a different port: `PORT=8080 node server.js`

## License

This project is provided as-is for educational and personal use. Use at your own risk.

## Disclaimer

This tool generates real Ethereum private keys and addresses. Users are responsible for the secure handling and storage of generated keys. The authors are not responsible for any loss of funds or security breaches resulting from the use of this tool.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Author

Brandon Jensen - [GitHub](https://github.com/brandonjensengit)
