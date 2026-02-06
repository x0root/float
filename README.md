<p align="center">
  <img src="logo.png" alt="Float Logo" width="200">
</p>

# Float - Browser-Based Linux Container Platform

Run Linux containers in your browser via WebAssembly. Debian runs client-side; optional server endpoints provide a command API and an HTTP gateway.

Float is an open-source, client-side containerization platform that runs full Linux environments directly in the browser through WebAssembly. Built on CheerpX's x86 emulation and JIT engine, it enables developers to spin up multiple isolated Debian containers from a single disk image, all running entirely on the client side without backend infrastructure.

With its container management API and Docker-inspired orchestration, Float lets developers programmatically control, connect to, and manage containers through a familiar interface, while offloading compute costs from servers to users' browsers. The platform is deployable on any static host like Vercel or localhost, with networking that leverages the host environment for internet access, making it a zero-backend solution for running Linux containers at scale.

---

## Features

- **Client-side VM execution**: CheerpX runs in the browser; no backend required to execute the VM.
- **Debian and Alpine images**: Debian terminal route and Alpine GUI route.
- **Headless runner**: Optional Puppeteer automation for API-driven execution.
- **HTTP gateway**: Optional server-side proxy so the VM can fetch external URLs.
- **Disk streaming**: Root filesystem is an ext2 image streamed on demand.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Float     │  │   xterm.js  │  │   Service Worker    │ │
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

### How It Works

1. **CheerpX Virtual Machine**: The core engine JIT-compiles x86 instructions to WebAssembly in real-time. It emulates Linux syscalls and provides virtual block devices and network interfaces.

2. **Disk Images**: Linux filesystems (ext2 format) are streamed on-demand over WebSocket connections. Only the disk sectors needed by running processes are fetched, with local caching via IndexedDB for performance.

3. **HTTP Gateway**: A server-side proxy endpoint (`/api/gateway`) allows the VM to fetch external web resources. Requests are initiated from inside the VM by printing marker strings in the terminal output. The host UI intercepts markers and performs the fetch.

4. **Headless Runner**: A Puppeteer-based automation script runs the VM in a headless Chrome instance, enabling API-driven command execution without a visible browser window.

5. **Container Management API**: REST endpoints allow programmatic control - submit commands, retrieve output, and manage multiple container instances remotely.

---

## Quick Start

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

### 3. Development Server
```bash
npm run dev
# Access UI: http://localhost:5173 (Debian Terminal)
# Alpine GUI: http://localhost:5173/alpine
```

### 4. Headless Mode (Background Execution)
```bash
# Auto-runs with `npm run dev` or separately:
npm run headless
```

---

## Usage Guide

### Interactive Terminal
The default route (`/`) provides a full Debian terminal running `/bin/bash` with a complete user environment (vim, python, curl, etc.).

### Alpine Linux GUI
Visit `/alpine` for a graphical Alpine Linux experience with `/sbin/init` and display support.

### Remote API Control
Execute commands programmatically via the headless runner:

```bash
# Submit command
curl -X POST "http://localhost:5173/api?api_key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cmd":"python3 -c \"print(2+2)\""}'
```

### Internet Access from VM
Run standard networking commands inside the VM:

```bash
curl https://example.com
wget https://example.com/file.txt
```

These requests are intercepted via terminal markers (`__FETCH__...__ENDFETCH__`), forwarded through the HTTP Gateway, and responses are injected back into the terminal output.

### Network Gateway: Technical Details

#### What the gateway is
The gateway is a normal HTTP endpoint implemented in SvelteKit:

- **Endpoint**: `POST /api/gateway?api_key=...`
- **Purpose**: fetch a URL from the host environment and return data to the VM.

The VM itself does not have a full network stack or DNS in the browser sandbox. Instead, the UI proxies web requests.

#### Marker protocol
The WebVM terminal output is scanned for markers:

- **Text fetch**: `__FETCH__<url>__ENDFETCH__`
- **Header-only (HEAD) fetch**: `__FETCH_HEAD__<url>__ENDFETCH_HEAD__`
- **Binary fetch (base64-encoded)**: `__FETCH_B64__<url>__ENDFETCH_B64__`

The UI injects the response back to the VM, terminated by:

- `__ENDRESPONSE__`

#### Limitations
- This is **not** a general-purpose socket/network layer. It is a URL fetch bridge.
- Large responses can be slow (especially binary/base64) and may hit timeouts.
- Only the host can see the real network; the VM cannot directly resolve DNS.

---

## Security

**WARNING**: Float executes binary code in your browser sandbox.

- **Browser Isolation**: Runs inside WebAssembly sandbox - cannot access host OS files
- **API Key Protection**: All `/api` endpoints require `API_KEY` authentication
- **Network Segmentation**: VM "localhost" is isolated from host localhost
- **No Privileged Operations**: All VM operations are unprivileged (uid 1000 in Debian)

---

## Development

### Project Structure
```
src/
├── lib/
│   ├── WebVM.svelte          # Main VM component (CheerpX integration)
│   ├── rpc_scripts.js        # VM-side curl/wget proxy script
│   ├── net_gateway.js        # VM-side /tmp/net helper (curl/wget + HEAD)
│   ├── commandExecutor.js    # API command polling
│   ├── activities.js         # CPU/disk activity monitoring
│   └── ...
├── routes/
│   ├── api/                  # API endpoints (gateway, command queue)
│   ├── alpine/               # Alpine Linux GUI route
│   └── remote/               # Remote console UI
├── app.html                  # HTML shell with CheerpX loader
scripts/
└── headless-webvm.js         # Puppeteer automation
```

### Customizing the Debian Image with Docker

The Debian environments used by Float are built from the Dockerfiles in `dockerfiles/`.

- `dockerfiles/debian_mini`
  - Smaller package set.
- `dockerfiles/debian_large`
  - Larger package set.

Both Dockerfiles:

- Start from an i386 Debian base image (`i386/debian:bookworm`).
- Install packages via `apt-get install ...`.
- Create a `user` account and set passwords (`user:password`, `root:password`).
- Copy `./examples` into `/home/user/examples`.

If you modify the package list in either Dockerfile, it changes what tools are present inside the VM image (for example adding/removing `vim`, `python3`, `gcc`, etc.).

#### How the Dockerfile affects the VM
The VM root filesystem is an ext2 disk image derived from the container filesystem produced by these Dockerfiles. The app points at a specific prebuilt disk image URL (see `config_public_terminal.js` and `.env`). Updating the Dockerfiles does not change the running VM until you rebuild and host a new disk image.

#### High-level rebuild flow
1. Edit `dockerfiles/debian_mini` or `dockerfiles/debian_large`.
2. Build the Docker image.
3. Export the filesystem and convert it into an ext2 disk image.
4. Host the ext2 image on a server that supports range requests / streaming.
5. Update `DISK_SOURCE` to point at your new disk image.

Exact image build/export steps depend on your environment and hosting choice. The key point is:

- **Dockerfile change** -> **new disk image build** -> **update `DISK_SOURCE`**

---

## Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/cool-thing`
3. **Commit** your changes
4. **Push** to the branch
5. **Open** a Pull Request

---

Powered by [Leaning Technologies](https://leaningtech.com)
