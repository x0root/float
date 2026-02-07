const instances = new Map();

function now() {
	return Date.now();
}

export function upsertInstance({ id, name, runAt, api, meta }) {
	const existing = instances.get(id);
	const next = {
		id,
		name: name ?? existing?.name ?? id,
		runAt: runAt ?? existing?.runAt ?? '',
		api: api ?? existing?.api ?? '',
		meta: meta ?? existing?.meta ?? {},
		createdAt: existing?.createdAt ?? now(),
		lastSeenAt: now(),
		terminateRequested: existing?.terminateRequested ?? false,
		stopped: existing?.stopped ?? false
	};
	// Any heartbeat/upsert implies the VM is running again.
	if (existing?.stopped) next.stopped = false;
	instances.set(id, next);
	return next;
}

export function getInstance(id) {
	return instances.get(id) || null;
}

export function listInstances({ staleAfterMs = 30000 } = {}) {
	const t = now();
	const out = [];
	for (const inst of instances.values()) {
		const isOnline = t - inst.lastSeenAt <= staleAfterMs;
		out.push({
			id: inst.id,
			name: inst.name,
			runAt: inst.runAt,
			api: inst.api,
			createdAt: inst.createdAt,
			lastSeenAt: inst.lastSeenAt,
			online: isOnline,
			terminateRequested: inst.terminateRequested,
			stopped: !!inst.stopped
		});
	}
	out.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
	return out;
}

export function requestTerminate(id) {
	const inst = instances.get(id);
	if (!inst) return false;
	inst.terminateRequested = true;
	inst.lastSeenAt = now();
	instances.set(id, inst);
	return true;
}

export function clearInstance(id) {
	return instances.delete(id);
}

export function renameInstance(id, newName) {
	const inst = instances.get(id);
	if (!inst) return false;
	inst.name = newName;
	inst.lastSeenAt = now();
	instances.set(id, inst);
	return true;
}

export function getInstanceCommands(id) {
	const inst = instances.get(id);
	if (!inst) return [];
	const cmds = [];
	if (inst.terminateRequested) {
		cmds.push({ type: 'terminate' });
	}
	return cmds;
}

export function markTerminated(id) {
	const inst = instances.get(id);
	if (!inst) return false;
	inst.terminateRequested = false;
	inst.lastSeenAt = now();
	instances.set(id, inst);
	return true;
}

export function markStopped(id) {
	const inst = instances.get(id);
	if (!inst) return false;
	inst.stopped = true;
	inst.terminateRequested = false;
	inst.lastSeenAt = 0;
	instances.set(id, inst);
	return true;
}
