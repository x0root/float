import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { getInstanceCommands, markTerminated, upsertInstance } from '$lib/server/webvmRegistry.js';

function validateApiKey(request, url) {
	const authHeader = request.headers.get('Authorization');
	const queryApiKey = url.searchParams.get('api_key');

	if (authHeader) {
		const [scheme, token] = authHeader.split(' ');
		if (scheme?.toLowerCase() === 'bearer' && token === env.API_KEY) {
			return true;
		}
	}

	if (queryApiKey === env.API_KEY) {
		return true;
	}

	return false;
}

export async function POST(event) {
	if (!env.API_KEY) {
		throw error(500, { message: 'Server configuration error: API_KEY not configured' });
	}
	if (!validateApiKey(event.request, event.url)) {
		throw error(401, { message: 'Unauthorized' });
	}

	let body;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON body' });
	}

	const id = (body?.id || '').toString().trim();
	if (!id) {
		throw error(400, { message: 'Missing id' });
	}

	const inst = upsertInstance({
		id,
		name: body?.name,
		runAt: body?.runAt,
		api: body?.api,
		meta: body?.meta
	});

	const commands = getInstanceCommands(id);
	if (commands.some((c) => c.type === 'terminate')) {
		markTerminated(id);
	}

	return json({
		success: true,
		instance: {
			id: inst.id,
			name: inst.name,
			runAt: inst.runAt,
			api: inst.api
		},
		commands
	});
}
