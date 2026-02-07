# Contributing

Thanks for your interest in contributing to Float.

## Code of Conduct

Be respectful and constructive. Assume good intent.

## Quick Start (Local Development)

### Prerequisites

- Node.js (recommended: latest LTS)
- npm

### Install

```bash
npm install
```

### Configure environment

Create a `.env` file in the repo root:

```ini
API_KEY=your-secret-api-key-here
DISK_SOURCE=wss://disks.webvm.io/debian_large_20230522_5044875331.ext2
MANAGER_USER=manager
MANAGER_PASSWORD=manager
```

### Run in development

```bash
npm run dev
```

- App: `http://localhost:5173/`
- Manager: `http://localhost:5173/manager`

### Run in preview mode

```bash
npm run build
npm run preview
```

## Project Concepts

- The VM runs client-side (CheerpX in the browser).
- `/api` is a command queue. Commands are executed by a browser instance running the app (typically via the Puppeteer headless runner).
- The Manager dashboard can spawn multiple per-VM preview servers and per-VM headless runners.

## Common Workflows to Test

### 1) Command API

Submit a command:

```bash
curl -X POST "http://localhost:5173/api?api_key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cmd":"uname -a"}'
```

### 2) Manager lifecycle

- Create a VM in `/manager`
- Run a command against that VM’s port (shown as `Run at`)
- Terminate the VM and verify the port stops responding
- Start it again and verify it responds

### 3) Gateway behavior

From inside the VM interactive terminal, run `curl https://example.com` and verify it succeeds.

## Development Guidelines

### Style

- Follow existing code style in the file you are editing.
- Keep changes small and focused.
- Avoid unrelated formatting churn.

### Security

- Do not hardcode secrets (API keys, passwords).
- Do not commit runtime logs or build outputs.

### Files you should not commit

- `.webvm-logs/`
- `.svelte-kit/`
- `dist/`
- `.vite/`

## Pull Requests

### Before opening a PR

- Ensure `npm run build` succeeds.
- Test at least one VM flow relevant to your change (interactive and/or headless).

### PR description checklist

Include:

- What you changed
- Why you changed it
- How to test
- Any known limitations

## Reporting Bugs / Requesting Features

Open an issue and include:

- OS + Node version
- Whether you used `npm run dev` or `npm run preview`
- Steps to reproduce
- Relevant logs (for per-VM runner issues: `.webvm-logs/<vmId>.headless.log`)
