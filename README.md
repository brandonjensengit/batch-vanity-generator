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
   - **Number of Addresses**: How many addresses to generate (ignored for Deployment Set/Containers modes)
   - **Threads**: Number of CPU threads to use (recommend 10-16 for best performance)
   - **Output Format**: Choose from available formats

4. Click "Start Generation" and watch the addresses appear in real-time

5. Use "Download Results" to save your generated addresses

### Command Line Interface

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

## Output Formats

### Deployment Set Format

Generates exactly **40 Ethereum addresses** organized into 4 sets, perfect for multi-signature wallet deployments:

```
Omnibus
=======

  Approver-1:
    Approver Key:  0x1234...abcd, 5678...efgh
    Emergency Key: 0x9012...ijkl, 3456...mnop

  Approver-2:
    ...

Investigation
=============

  Approver-1:
    ...

Garbage
=======

  Approver-1:
    ...

Firm Wallet
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

1. **Private Key Security**:
   - Never share your private keys with anyone
   - Store generated keys in a secure, encrypted location
   - Delete output files after securely storing keys elsewhere

2. **Network Security**:
   - Only run the web interface on trusted networks
   - Do not expose the server to the public internet without proper authentication

3. **Randomness**:
   - This tool uses cryptographically secure random number generation
   - Generated addresses are secure for production use

4. **Generated Files**:
   - Output files (`.txt`, `.csv`, `.json`) contain unencrypted private keys
   - Always delete these files after use
   - Never commit these files to version control

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
