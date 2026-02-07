import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import { clearManagerSessionCookie, createManagerSessionToken, isManagerAuthed, setManagerSessionCookie } from '$lib/server/managerAuth.js';

export function load({ cookies }) {
	if (isManagerAuthed(cookies)) {
		throw redirect(303, '/manager');
	}
	if (cookies.get('manager_session')) {
		clearManagerSessionCookie(cookies);
	}
}

export const actions = {
	default: async ({ request, cookies }) => {
		if (!env.MANAGER_USER || !env.MANAGER_PASSWORD) {
			return fail(500, { error: 'Server configuration error: MANAGER_USER or MANAGER_PASSWORD not configured' });
		}

		const data = await request.formData();
		const username = (data.get('username') || '').toString();
		const password = (data.get('password') || '').toString();

		if (username !== env.MANAGER_USER || password !== env.MANAGER_PASSWORD) {
			return fail(401, { error: 'Invalid username or password' });
		}

		const token = createManagerSessionToken(username);
		setManagerSessionCookie(cookies, token);
		throw redirect(303, '/manager');
	}
};
