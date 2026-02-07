import { execFile } from 'node:child_process';

function execDocker(args) {
	return new Promise((resolve, reject) => {
		execFile('docker', args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
			if (err) {
				const code = err.code;
				if (code === 'ENOENT') {
					reject(new Error('docker CLI not found. Install Docker Desktop and ensure `docker` is in PATH.'));
					return;
				}
				reject(new Error((stderr || stdout || err.message || 'docker error').toString()));
				return;
			}
			resolve((stdout || '').toString());
		});
	});
}

function parsePorts(portsStr) {
	if (!portsStr) return [];
	const ports = [];
	for (const part of portsStr.split(',').map((p) => p.trim()).filter(Boolean)) {
		const m = part.match(/(?:(?<ip>\d+\.\d+\.\d+\.\d+):)?(?<hostPort>\d+)->(?<containerPort>\d+)(?:\/\w+)?/);
		if (m?.groups?.hostPort) {
			ports.push({
				hostPort: Number(m.groups.hostPort),
				containerPort: Number(m.groups.containerPort || 0),
				raw: part
			});
		} else {
			ports.push({ raw: part });
		}
	}
	return ports;
}

export async function listContainers() {
	const out = await execDocker(['ps', '-a', '--format', '{{json .}}']);
	const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	const containers = [];
	for (const line of lines) {
		let row;
		try {
			row = JSON.parse(line);
		} catch {
			continue;
		}
		const ports = parsePorts(row.Ports);
		const hostPorts = ports.map((p) => p.hostPort).filter((p) => typeof p === 'number' && !Number.isNaN(p));
		const primaryPort = hostPorts[0] ?? null;
		containers.push({
			id: row.ID,
			name: (row.Names || '').toString(),
			image: (row.Image || '').toString(),
			status: (row.Status || '').toString(),
			state: (row.State || '').toString(),
			ports,
			primaryPort,
			runAt: primaryPort ? `localhost:${primaryPort}` : '',
			api: primaryPort ? `localhost:${primaryPort}` : ''
		});
	}
	return containers;
}

export async function stopContainer(id) {
	await execDocker(['stop', id]);
}

export async function removeContainer(id) {
	await execDocker(['rm', '-f', id]);
}

export async function renameContainer(id, newName) {
	await execDocker(['rename', id, newName]);
}
