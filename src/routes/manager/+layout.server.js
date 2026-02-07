import { requireManagerAuth } from '$lib/server/managerAuth.js';

export function load(event) {
	if (event.url?.pathname === '/manager/login') {
		return;
	}
	requireManagerAuth(event);
}
