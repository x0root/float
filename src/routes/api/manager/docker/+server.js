import { json } from '@sveltejs/kit';
import { requireManagerAuthApi } from '$lib/server/managerAuth.js';
import { listContainers, renameContainer, removeContainer, stopContainer } from '$lib/server/dockerManager.js';

export async function GET(event) {
	requireManagerAuthApi(event);
	try {
		const containers = await listContainers();
		return json({ containers });
	} catch (e) {
		return json({ message: e?.message || 'Failed to list containers' }, { status: 500 });
	}
}

export async function POST(event) {
	requireManagerAuthApi(event);
	let body;
	try {
		body = await event.request.json();
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}

	const action = body?.action;
	const id = body?.id;
	if (!action || !id) {
		return json({ message: 'Missing action or id' }, { status: 400 });
	}

	try {
		switch (action) {
			case 'stop':
				await stopContainer(id);
				break;
			case 'remove':
				await removeContainer(id);
				break;
			case 'rename': {
				const newName = (body?.newName || '').toString().trim();
				if (!newName) return json({ message: 'Missing newName' }, { status: 400 });
				await renameContainer(id, newName);
				break;
			}
			default:
				return json({ message: 'Unsupported action' }, { status: 400 });
		}
		return json({ success: true });
	} catch (e) {
		return json({ message: e?.message || 'Action failed' }, { status: 500 });
	}
}
