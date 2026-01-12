# X402 Monetization Demo

A comprehensive Astro demo application showcasing the complete Pinata X402 Monetization API functionality with file upload, management, and payment instruction workflows.

## Features

### File Management
- Upload files to IPFS via Pinata
- View uploaded files with metadata (CID, size, type, creation date)
- Delete files from Pinata
- Direct links to view files via IPFS gateway

### Payment Instructions
- Create payment instructions with multiple payment requirements
- Support for different cryptocurrencies and networks
- View and manage existing payment instructions  
- Update and delete payment instructions

### CID-Payment Association
- Associate uploaded file CIDs with payment instructions
- View current associations for any file
- Remove CID associations
- Attach multiple payment instructions to a single file

### Auto-Run Demo
- **🚀 One-click complete workflow demonstration**
- Automatically generates unique timestamped test files
- Uploads files and creates payment instructions
- Associates CIDs with payment instructions
- Provides detailed step-by-step results
- Perfect for testing and demonstrating the entire API flow

## Setup

1. Copy `.env.example` to `.env` and add your Pinata JWT:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:4321`

## Environment Variables

- `PINATA_JWT` - Your Pinata API JWT token (required)

## API Endpoints

The demo includes the following API routes:

### File Management
- `GET /api/files` - List uploaded files
- `POST /api/files` - Upload new file
- `GET /api/files/[id]` - Get file information
- `PATCH /api/files/[id]` - Update file metadata
- `DELETE /api/files/[id]` - Delete file

### Payment Instructions
- `GET /api/payment-instructions` - List payment instructions
- `POST /api/payment-instructions` - Create payment instruction
- `GET /api/payment-instructions/[id]` - Get payment instruction
- `PATCH /api/payment-instructions/[id]` - Update payment instruction
- `DELETE /api/payment-instructions/[id]` - Delete payment instruction

### CID Management
- `GET /api/payment-instructions/[id]/cids` - List CIDs for payment instruction
- `PUT /api/payment-instructions/[id]/cids/[cid]` - Add CID to payment instruction
- `DELETE /api/payment-instructions/[id]/cids/[cid]` - Remove CID from payment instruction

### Auto-Run Demo
- `POST /api/auto-run` - Execute complete demo workflow

## Usage

### Quick Start - Auto-Run Demo
1. **🚀 Click "Run Complete Demo"** - This will automatically execute the entire workflow:
   - Generate a unique test file with timestamp
   - Upload it to IPFS
   - Create payment instructions with ETH and USDC options
   - Associate the CID with payment instructions
   - Display detailed results

### Manual Workflow
1. **Upload Files**: Use the file upload form to upload content to IPFS and get CIDs.

2. **Create Payment Instructions**: Fill out the form with payment details:
   - **Asset**: Contract address (e.g., `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
   - **Pay To Address**: Recipient wallet address
   - **Network**: `base`, `base-sepolia`, `eip155:8453`, or `eip155:84532`
   - **Amount**: Amount in smallest unit (e.g., `1000000` for token amounts)

3. **Associate Files with Payments**: Click "Attach Payment" on any file to associate it with existing payment instructions.

4. **View and Manage**: 
   - View all files with their metadata and gateway links
   - View payment instructions with their requirements
   - Manage CID associations through modals

5. **Delete and Clean Up**: Remove files, payment instructions, or associations as needed.

## Project Structure

```
src/
├── components/          # Reusable Astro components
├── layouts/            # Page layouts
├── pages/              # Pages and API routes
│   ├── api/           # API endpoints
│   └── index.astro    # Main page
└── public/            # Static assets
```

## Technologies Used

- [Astro](https://astro.build/) - Web framework
- [Pinata SDK](https://docs.pinata.cloud/) - X402 Monetization API
- Vanilla JavaScript - Frontend interactions
- CSS - Styling