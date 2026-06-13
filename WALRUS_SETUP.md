# Sui & Walrus Testnet Setup Guide

Your local environment has been fully configured to interact with the Sui Testnet and the Walrus decentralized storage network.

## Binaries & Paths
The CLI binaries have been installed in:
- Directory: `C:\Users\jmuni\.gemini\antigravity\scratch\bin\`
- **Sui CLI**: `C:\Users\jmuni\.gemini\antigravity\scratch\bin\sui.exe`
- **Walrus CLI**: `C:\Users\jmuni\.gemini\antigravity\scratch\bin\walrus.exe`

## Configurations
- **Sui Wallet**: `C:\Users\jmuni\.sui\sui_config\client.yaml`
- **Walrus Config**: `C:\Users\jmuni\.config\walrus\client_config.yaml`
- **Active Sui Address**: `0x252ee618862294fb5e9cd89bee7479d920f1d0e6863036f97cd1fd625a29d078`
- **Active Network**: `testnet`

---

## Next Steps: Fund & Swap

### 1. Fund Your Sui Wallet
Since the REST API for the Sui Testnet faucet is heavily rate-limited and protected, you must request tokens via the browser:
- **Faucet Link**: [Request Testnet SUI](https://faucet.sui.io/?address=0x252ee618862294fb5e9cd89bee7479d920f1d0e6863036f97cd1fd625a29d078)
- Click the link, verify the captcha, and click request to instantly receive 1 SUI.

### 2. Verify Your SUI Balance
Once funded, verify your balance from the terminal:
```powershell
& "C:\Users\jmuni\.gemini\antigravity\scratch\bin\sui.exe" client balance
```

### 3. Swap SUI for WAL
To store files on Walrus, you need WAL tokens. Swap your newly received SUI for WAL by running:
```powershell
& "C:\Users\jmuni\.gemini\antigravity\scratch\bin\walrus.exe" get-wal
```
*(This will exchange a portion of your SUI for WAL using the testnet exchange pool)*

---

## How to Store & Read Files on Walrus

### Store a File
To upload a file and get its unique `Blob ID`:
```powershell
& "C:\Users\jmuni\.gemini\antigravity\scratch\bin\walrus.exe" store <path-to-file>
```
Example Output:
```json
{
  "newlyCreated": {
    "blobObject": {
      "id": "0x...",
      "registeredEpoch": 428,
      "blobId": "H4aK...d3a",
      "size": 1048576
    }
  }
}
```

### Read a File
To download/retrieve a file from the network:
```powershell
& "C:\Users\jmuni\.gemini\antigravity\scratch\bin\walrus.exe" read <blob-id> --out-file <dest-path>
```
