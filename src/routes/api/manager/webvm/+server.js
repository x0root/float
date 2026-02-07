import { json } from '@sveltejs/kit';
import { requireManagerAuthApi } from '$lib/server/managerAuth.js';
import {
	clearInstance,
	getInstance,
	listInstances,
	markStopped,
	renameInstance,
	requestTerminate,
	upsertInstance
} from '$lib/server/webvmRegistry.js';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';

const UNSAFE_PORTS = new Set([
	// Common Chrome/Firefox blocked ports (partial list, plus observed 6566)
	1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 77, 79, 87, 95, 101, 102, 103,
	104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 139, 143, 179, 389, 427, 465, 512, 513, 514,
	515, 526, 530, 531, 532, 540, 548, 556, 563, 587, 601, 636, 993, 995, 2049, 3659, 4045, 6000,
	6566, 10080
]);

function isUnsafePort(port) {
	if (!Number.isFinite(port)) return true;
	if (port <= 0 || port > 65535) return true;
	if (UNSAFE_PORTS.has(port)) return true;
	// Chrome blocks 6665-6669
	if (port >= 6665 && port <= 6669) return true;
	return false;
}

function getNpmCommand() {
	return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function formatSpawnError(e) {
	if (!e || typeof e !== 'object') return String(e || '');
	const parts = [];
	if (e.message) parts.push(e.message);
	if (e.code) parts.push(`code=${e.code}`);
	if (e.syscall) parts.push(`syscall=${e.syscall}`);
	if (e.path) parts.push(`path=${e.path}`);
	if (Array.isArray(e.spawnargs)) parts.push(`args=${JSON.stringify(e.spawnargs)}`);
	return parts.join(' | ');
}

function spawnPreviewServer({ port, cwd, childEnv }) {
	// Avoid spawning npm/cmd.exe entirely to prevent Windows EINVAL and avoid popping a terminal window.
	// Run the Vite CLI directly via Node.
	const nodeExec = process.execPath;
	const viteBin = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');
	return {
		child: spawn(nodeExec, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
		cwd,
		// When stdio is piped on Windows, detached processes can throw EINVAL.
		// We keep it non-detached and unref() it after it is confirmed started.
		detached: false,
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
		env: childEnv
		}),
		viteBin
	};
}

async function pickFreePort(preferredPort = 0) {
	const server = net.createServer();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen({ host: '127.0.0.1', port: preferredPort || 0 }, resolve);
	});
	const addr = server.address();
	const port = typeof addr === 'object' && addr ? addr.port : 0;
	await new Promise((resolve) => server.close(resolve));
	if (!port) throw new Error('Failed to allocate a free port');
	return port;
}

async function waitForPortOpen(port, timeoutMs = 30_000) {
	const startedAt = Date.now();
	let lastErr = '';
	while (Date.now() - startedAt < timeoutMs) {
		try {
			await new Promise((resolve, reject) => {
				const hosts = [
					{ host: '127.0.0.1' },
					{ host: '::1' },
					{ host: 'localhost' }
				];
				let idx = 0;
				const tryNext = () => {
					if (idx >= hosts.length) return reject(new Error(lastErr || 'ECONNREFUSED'));
					const opts = hosts[idx++];
					const sock = net.createConnection({ ...opts, port }, () => {
						sock.end();
						resolve();
					});
					sock.once('error', (e) => {
						lastErr = e?.message || String(e);
						tryNext();
					});
				};
				tryNext();
			});
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 250));
		}
	}
	throw new Error(`Timed out waiting for port ${port} to open${lastErr ? ` (${lastErr})` : ''}`);
}

function sanitizeEnv(envObj) {
	const out = {};
	for (const [k, v] of Object.entries(envObj || {})) {
		if (v === undefined || v === null) continue;
		out[k] = typeof v === 'string' ? v : String(v);
	}
	return out;
}

async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

function isPidAlive(pid) {
	if (!pid || !Number.isFinite(pid)) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function waitForChildOrPort({ child, port, timeoutMs = 30_000 }) {
	const errorPromise = new Promise((_, reject) => {
		child.once('error', (e) => reject(e));
	});
	const exitPromise = new Promise((_, reject) => {
		child.once('exit', (code, signal) => reject(new Error(`Process exited early (code=${code}, signal=${signal})`)));
	});
	await Promise.race([waitForPortOpen(port, timeoutMs), errorPromise, exitPromise]);
}

export async function GET(event) {
	requireManagerAuthApi(event);
	return json({ instances: listInstances(), apiKey: env.API_KEY || '' });
}

export async function POST(event) {
	requireManagerAuthApi(event);
	let body;
	try {
		body = await event.request.json();
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}

	const action = (body?.action || '').toString();

	// Create new VM instance
	if (action === 'create') {
		// Serverless platforms (like Vercel) do not allow spawning long-running child processes.
		if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
			return json(
				{ message: 'Create VM is not supported on serverless (Vercel). Run the manager on a persistent Node server to spawn VMs.' },
				{ status: 501 }
			);
		}

		const name = (body?.name || 'WebVM').toString().trim();
		const diskSource = (body?.diskSource || env.DISK_SOURCE || '').toString().trim();
		const requestedPort = Number(body?.port) || 0;

		if (!diskSource) {
			return json({ message: 'No disk source configured. Set DISK_SOURCE in .env or provide it.' }, { status: 400 });
		}
		if (!Number.isFinite(requestedPort) || requestedPort < 0) {
			return json({ message: 'Invalid port' }, { status: 400 });
		}

		const id = `webvm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
		if (requestedPort > 0 && isUnsafePort(requestedPort)) {
			return json(
				{
					message:
						`Port ${requestedPort} is blocked by the browser (ERR_UNSAFE_PORT). Choose a different port (e.g. 5173, 4173, 5637).`
				},
				{ status: 400 }
			);
		}

		let port;
		try {
			if (requestedPort > 0) {
				port = await pickFreePort(requestedPort);
			} else {
				// Auto-pick a free, browser-safe port (retry a few times)
				for (let i = 0; i < 20; i++) {
					const candidate = await pickFreePort(0);
					if (!isUnsafePort(candidate)) {
						port = candidate;
						break;
					}
				}
				if (!port) throw new Error('Failed to allocate a browser-safe port');
			}
		} catch (e) {
			return json({ message: e?.message || 'Failed to pick free port' }, { status: 500 });
		}
		const vmUrl = `http://localhost:${port}`;

		// Spawn a dedicated server for this VM (server-only, no headless runner)
		const projectRoot = process.env.INIT_CWD || process.cwd();
		let serverProc;
		const serverEnv = sanitizeEnv({
			...process.env,
			DISK_SOURCE: diskSource,
			API_KEY: env.API_KEY
		});
		const viteBinPath = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
		try {
			await fs.access(viteBinPath);
		} catch {
			return json(
				{ message: `Vite binary not found at ${viteBinPath}. Run npm install.` },
				{ status: 500 }
			);
		}
		try {
			serverProc = spawnPreviewServer({ port, cwd: projectRoot, childEnv: serverEnv }).child;
		} catch (e) {
			return json({ message: `Failed to spawn VM server: ${formatSpawnError(e)}` }, { status: 500 });
		}
		let serverLogs = '';
		const appendLog = (chunk) => {
			serverLogs += chunk.toString();
			if (serverLogs.length > 8000) serverLogs = serverLogs.slice(serverLogs.length - 8000);
		};
		serverProc.stdout?.on('data', appendLog);
		serverProc.stderr?.on('data', appendLog);
		try {
			await waitForChildOrPort({ child: serverProc, port });
		} catch (e) {
			const msg = (e?.message || `Failed to start VM server on port ${port}`).trim();
			return json(
				{ message: `${msg}${serverLogs ? `\n\n--- vite output ---\n${serverLogs}` : ''}` },
				{ status: 500 }
			);
		}
		// Allow the child to live independently of the current event loop.
		serverProc.unref();

		// Spawn headless runner for this VM
		// NOTE: In `vite preview` (built output), `import.meta.url` points inside `.svelte-kit/output/...`
		// so relative paths would break. Resolve from the actual project root instead.
		const headlessScript = path.join(projectRoot, 'scripts', 'headless-webvm.js');
		try {
			await fs.access(headlessScript);
		} catch {
			return json(
				{ message: `Headless runner script not found at ${headlessScript}` },
				{ status: 500 }
			);
		}
		const nodeExec = process.execPath;
		const logsDir = path.join(projectRoot, '.webvm-logs');
		await ensureDir(logsDir);
		const headlessLogPath = path.join(logsDir, `${id}.headless.log`);
		const headlessFd = fsSync.openSync(headlessLogPath, 'a');
		const child = spawn(nodeExec, [headlessScript], {
			cwd: projectRoot,
			detached: true,
			stdio: ['ignore', headlessFd, headlessFd],
			windowsHide: true,
			env: {
				...sanitizeEnv(process.env),
				WEBVM_URL: vmUrl,
				WEBVM_ID: id,
				WEBVM_NAME: name,
				DISK_SOURCE: diskSource,
				API_KEY: env.API_KEY,
				HEADLESS: 'true'
			}
		});
		// Close parent's file descriptor (child has its own handle)
		try { fsSync.closeSync(headlessFd); } catch {}
		// If the runner dies immediately, surface a clear error.
		await new Promise((r) => setTimeout(r, 300));
		if (!isPidAlive(child.pid)) {
			return json(
				{ message: `Headless runner failed to start for VM ${id}. See log: ${headlessLogPath}` },
				{ status: 500 }
			);
		}
		child.unref();

		// Register instance immediately (will be updated by heartbeat)
		upsertInstance({
			id,
			name,
			runAt: vmUrl,
			api: `${vmUrl}/api`,
			meta: { pid: child.pid, diskSource, port, serverPid: serverProc.pid, headlessLogPath }
		});

		return json({
			success: true,
			instance: {
				id,
				name,
				runAt: vmUrl,
				api: `${vmUrl}/api`,
				port
			}
		});
	}

	const id = (body?.id || '').toString().trim();
	if (!action || !id) {
		return json({ message: 'Missing action or id' }, { status: 400 });
	}

	if (action === 'terminate') {
		const inst = getInstance(id);
		if (!inst) return json({ message: 'Instance not found' }, { status: 404 });

		// Ask the agent to terminate gracefully (best-effort)
		requestTerminate(id);

		// Also terminate processes directly so the button works even if the agent is stuck/offline.
		const pid = Number(inst?.meta?.pid) || 0;
		const serverPid = Number(inst?.meta?.serverPid) || 0;
		const killed = [];
		const errors = [];
		for (const [label, p] of [
			['headless', pid],
			['server', serverPid]
		]) {
			if (!p) continue;
			try {
				process.kill(p);
				killed.push({ type: label, pid: p });
			} catch (e) {
				errors.push({ type: label, pid: p, error: formatSpawnError(e) });
			}
		}

		markStopped(id);
		return json({ success: true, killed, errors });
	}

	if (action === 'start') {
		if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
			return json(
				{ message: 'Start VM is not supported on serverless (Vercel). Run the manager on a persistent Node server to spawn VMs.' },
				{ status: 501 }
			);
		}
		const inst = getInstance(id);
		if (!inst) return json({ message: 'Instance not found' }, { status: 404 });

		const name = (inst?.name || 'WebVM').toString().trim();
		const diskSource = (inst?.meta?.diskSource || env.DISK_SOURCE || '').toString().trim();
		const preferredPort = Number(inst?.meta?.port) || 0;
		if (!diskSource) {
			return json({ message: 'No disk source configured for this instance' }, { status: 400 });
		}

		let port;
		try {
			if (preferredPort > 0) {
				if (isUnsafePort(preferredPort)) throw new Error(`Port ${preferredPort} is blocked by the browser (ERR_UNSAFE_PORT)`);
				port = await pickFreePort(preferredPort);
			} else {
				for (let i = 0; i < 20; i++) {
					const candidate = await pickFreePort(0);
					if (!isUnsafePort(candidate)) {
						port = candidate;
						break;
					}
				}
				if (!port) throw new Error('Failed to allocate a browser-safe port');
			}
		} catch (e) {
			return json({ message: e?.message || 'Failed to pick free port' }, { status: 500 });
		}
		const vmUrl = `http://localhost:${port}`;

		const projectRoot = process.env.INIT_CWD || process.cwd();
		let serverProc;
		const serverEnv = sanitizeEnv({
			...process.env,
			DISK_SOURCE: diskSource,
			API_KEY: env.API_KEY
		});
		const viteBinPath = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
		try {
			await fs.access(viteBinPath);
		} catch {
			return json({ message: `Vite binary not found at ${viteBinPath}. Run npm install.` }, { status: 500 });
		}
		try {
			serverProc = spawnPreviewServer({ port, cwd: projectRoot, childEnv: serverEnv }).child;
		} catch (e) {
			return json({ message: `Failed to spawn VM server: ${formatSpawnError(e)}` }, { status: 500 });
		}
		let serverLogs = '';
		const appendLog = (chunk) => {
			serverLogs += chunk.toString();
			if (serverLogs.length > 8000) serverLogs = serverLogs.slice(serverLogs.length - 8000);
		};
		serverProc.stdout?.on('data', appendLog);
		serverProc.stderr?.on('data', appendLog);
		try {
			await waitForChildOrPort({ child: serverProc, port });
		} catch (e) {
			const msg = (e?.message || `Failed to start VM server on port ${port}`).trim();
			return json(
				{ message: `${msg}${serverLogs ? `\n\n--- vite output ---\n${serverLogs}` : ''}` },
				{ status: 500 }
			);
		}
		serverProc.unref();

		// NOTE: In `vite preview` (built output), `import.meta.url` points inside `.svelte-kit/output/...`
		// so relative paths would break. Resolve from the actual project root instead.
		const headlessScript = path.join(projectRoot, 'scripts', 'headless-webvm.js');
		try {
			await fs.access(headlessScript);
		} catch {
			return json(
				{ message: `Headless runner script not found at ${headlessScript}` },
				{ status: 500 }
			);
		}
		const nodeExec = process.execPath;
		const logsDir = path.join(projectRoot, '.webvm-logs');
		await ensureDir(logsDir);
		const headlessLogPath = path.join(logsDir, `${id}.headless.log`);
		const headlessFd = fsSync.openSync(headlessLogPath, 'a');
		const child = spawn(nodeExec, [headlessScript], {
			cwd: projectRoot,
			detached: true,
			stdio: ['ignore', headlessFd, headlessFd],
			windowsHide: true,
			env: {
				...sanitizeEnv(process.env),
				WEBVM_URL: vmUrl,
				WEBVM_ID: id,
				WEBVM_NAME: name,
				DISK_SOURCE: diskSource,
				API_KEY: env.API_KEY,
				HEADLESS: 'true'
			}
		});
		try {
			fsSync.closeSync(headlessFd);
		} catch {}
		await new Promise((r) => setTimeout(r, 300));
		if (!isPidAlive(child.pid)) {
			return json(
				{ message: `Headless runner failed to start for VM ${id}. See log: ${headlessLogPath}` },
				{ status: 500 }
			);
		}
		child.unref();

		upsertInstance({
			id,
			name,
			runAt: vmUrl,
			api: `${vmUrl}/api`,
			meta: { pid: child.pid, diskSource, port, serverPid: serverProc.pid, headlessLogPath }
		});

		return json({
			success: true,
			instance: { id, name, runAt: vmUrl, api: `${vmUrl}/api`, port }
		});
	}

	if (action === 'delete') {
		const ok = clearInstance(id);
		if (!ok) return json({ message: 'Instance not found' }, { status: 404 });
		return json({ success: true });
	}

	if (action === 'rename') {
		const newName = (body?.newName || '').toString().trim();
		if (!newName) return json({ message: 'Missing newName' }, { status: 400 });
		const ok = renameInstance(id, newName);
		if (!ok) return json({ message: 'Instance not found' }, { status: 404 });
		return json({ success: true });
	}

	return json({ message: 'Unsupported action' }, { status: 400 });
}
