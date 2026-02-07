import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import crypto from 'node:crypto';

const COOKIE_NAME = 'manager_session';

function getSecret() {
	return env.MANAGER_SESSION_SECRET || env.API_KEY || '';
}

function sign(payload, secret) {
	return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createManagerSessionToken(username) {
	const secret = getSecret();
	if (!secret) {
		throw error(500, { message: 'Server configuration error: MANAGER_SESSION_SECRET or API_KEY not configured' });
	}
	const exp = Date.now() + 24 * 60 * 60 * 1000;
	const payload = JSON.stringify({ u: username, exp });
	const sig = sign(payload, secret);
	return Buffer.from(payload).toString('base64url') + '.' + sig;
}

export function isManagerAuthed(cookies) {
	const secret = getSecret();
	if (!secret) return false;
	const token = cookies.get(COOKIE_NAME);
	if (!token) return false;
	const parts = token.split('.');
	if (parts.length !== 2) return false;
	let payload;
	try {
		payload = Buffer.from(parts[0], 'base64url').toString('utf8');
	} catch {
		return false;
	}
	const expected = sign(payload, secret);
	const a = Buffer.from(parts[1]);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	if (!crypto.timingSafeEqual(a, b)) return false;
	try {
		const parsed = JSON.parse(payload);
		if (!parsed?.exp || Date.now() > parsed.exp) return false;
		return true;
	} catch {
		return false;
	}
}

export function requireManagerAuth(event) {
	if (!isManagerAuthed(event.cookies)) {
		throw redirect(303, '/manager/login');
	}
}

export function requireManagerAuthApi(event) {
	if (!isManagerAuthed(event.cookies)) {
		throw error(401, { message: 'Unauthorized' });
	}
}

export function setManagerSessionCookie(cookies, token) {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 24 * 60 * 60
	});
}

export function clearManagerSessionCookie(cookies) {
	cookies.delete(COOKIE_NAME, { path: '/' });
}
