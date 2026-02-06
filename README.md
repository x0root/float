<p align="center">
  <img src="logo.png" alt="WebVM Logo" width="200">
</p>

# WebVM - Browser-Based Linux Virtual Machine

> **Run Linux containers in your browser via WebAssembly. Zero backend, full Debian, multi-container support with dynamic networking.**

WebVM is a server-less virtualization environment that runs unmodified Linux binaries (x86) directly in your browser. Powered by [**CheerpX**](https://leaningtech.com/cheerpx) JIT engine, it translates x86 instructions to WebAssembly in real-time, enabling full Linux distributions like Debian and Alpine to run client-side without any backend infrastructure.

---

## ✨ What Makes WebVM Unique

- **🚀 Zero Backend Required**: Runs entirely in the browser using WebAssembly - no servers needed for VM execution
- **🐧 Full Linux Distributions**: Supports Debian (full terminal) and Alpine Linux (with GUI) out of the box
- **📦 Multi-Container Support**: Run multiple isolated Linux environments simultaneously via browser tabs
- **🌐 Dynamic Networking**: 
  - **Tailscale VPN**: Full TCP/UDP networking with exit node support
  - **HTTP Gateway**: Internet access via host proxy for web resources
  - **Network bridging** between VM and host environment
- **🔧 Real Binary Compatibility**: Runs unmodified x86 Linux executables - no recompilation needed
- **💾 Efficient Storage**: Block devices stream on-demand via HTTP/WebSocket (Range requests)
- **🖥️ Headless Mode**: Background execution via Puppeteer for API-driven automation

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   WebVM     │  │   xterm.js  │  │   Service Worker    │ │
│  │  (Svelte)   │  │  Terminal   │  │ (Lazy Disk Loading) │ │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘ │
│         │                                                    │
│  ┌──────▼────────────────────────────────────────────────┐ │
│  │         CheerpX JIT Engine (WebAssembly)               │ │
│  │  • x86 → Wasm JIT Compilation                        │ │
│  │  • Linux syscall emulation                           │ │
│  │  • ext2 filesystem support                           │ │
│  └──────┬─────────────────────────────────────────────────┘ │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                SERVER (Optional - for API)                   │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │  Command Queue  │  │      HTTP Gateway (Internet)     │ │
│  │   API Bridge    │  │  /api/gateway → proxy to web    │ │
│  └─────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

1. **CheerpX Virtual Machine**: JIT-compiles x86 instructions to WebAssembly, emulates Linux syscalls, provides virtual block devices and network interfaces
2. **Disk Images**: Streamed as-needed over WebSocket (wss://disks.webvm.io) - supports ext2 images with copy-on-write via IndexedDB caching
3. **HTTP Gateway**: Server-side proxy (`/api/gateway`) that allows the VM to fetch web resources using the host's internet connection
4. **Headless Runner**: Puppeteer-based automation for API-driven command execution without UI
5. **Tailscale Integration**: Full VPN networking for TCP/UDP socket support in the browser

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repository-url>
cd wvm-main
npm install
```

### 2. Configuration (`.env`)
Create a `.env` file to configure your environment:

```ini
# Security: Key required to authorize API commands
API_KEY=your-secret-api-key-here

# Storage: WebSocket URL for the Debian disk image
# Default: wss://disks.webvm.io/debian_large_20230522_5044875331.ext2
DISK_SOURCE=wss://disks.webvm.io/debian_large_20230522_5044875331.ext2
```

### 3. Dev & Run
```bash
npm run dev
# Access UI: http://localhost:5173 (Debian Terminal)
# Alpine GUI: http://localhost:5173/alpine
# Remote Console: http://localhost:5173/remote
```

### 4. Headless Mode (Background Execution)
```bash
# Auto-runs with `npm run dev` or separately:
npm run headless
```

---

## 📚 Usage Guide

### Interactive Terminal
The default route (`/`) provides a full Debian terminal running `/bin/bash` with a complete user environment (vim, python, etc.).

### Alpine Linux GUI
Visit `/alpine` for a graphical Alpine Linux experience with `/sbin/init` and display support.

### Remote API Control
Execute commands programmatically via the headless runner:

```bash
# Submit command
curl -X POST "http://localhost:5173/api?api_key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cmd":"python3 -c \"print(2+2)\""}'

# Or use the web UI at /remote
```

### Internet Access from VM
The VM has two networking modes:

1. **HTTP Gateway** (default): 
   ```bash
   curl https://example.com  # Fetched via browser → server proxy
   ```

2. **Tailscale VPN** (full networking):
   - Click "Connect to Tailscale" in the sidebar
   - Authenticate with your Tailscale account
   - Get full TCP/UDP socket support via exit nodes

---

## 🛡️ Security

> [!WARNING]
> WebVM executes binary code in your browser sandbox.

- **Browser Isolation**: Runs inside WebAssembly sandbox - cannot access host OS files
- **API Key Protection**: All `/api` endpoints require `API_KEY` authentication
- **Network Segmentation**: VM "localhost" is isolated from host localhost
- **No Privileged Operations**: All VM operations are unprivileged (uid 1000 in Debian)

---

## 🛠️ Development

### Project Structure
```
src/
├── lib/
│   ├── WebVM.svelte          # Main VM component (CheerpX integration)
│   ├── rpc_scripts.js        # VM-side curl/wget proxy script
│   ├── network.js            # Tailscale VPN management
│   ├── commandExecutor.js    # API command polling
│   └── ...
├── routes/
│   ├── api/                  # API endpoints (gateway, command queue)
│   ├── alpine/               # Alpine Linux GUI route
│   └── remote/               # Remote console UI
├── app.html                  # HTML shell with CheerpX loader
scripts/
└── headless-webvm.js         # Puppeteer automation
```

### Custom Disk Images
1. Create ext2 image: `mkfs.ext2 -N <inodes> <image>`
2. Install your software using standard package managers
3. Host on any HTTP server with Range header support (S3, Vercel Blob, etc.)
4. Update `DISK_SOURCE` in `.env`

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/cool-thing`
3. **Commit** your changes
4. **Push** to the branch
5. **Open** a Pull Request

---

*Powered by [Leaning Technologies](https://leaningtech.com)*
