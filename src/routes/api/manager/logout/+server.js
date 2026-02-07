import { json } from '@sveltejs/kit';
import { clearManagerSessionCookie, requireManagerAuthApi } from '$lib/server/managerAuth.js';

export async function POST(event) {
	requireManagerAuthApi(event);
	clearManagerSessionCookie(event.cookies);
	return json({ success: true });
}
