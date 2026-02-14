import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fetch as undiciFetch, ProxyAgent } from 'undici';

const proxyUrl =
	process.env.HTTPS_PROXY ||
	process.env.https_proxy ||
	process.env.HTTP_PROXY ||
	process.env.http_proxy ||
	'';

const proxyDispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : null;

function isAllowedUrl(rawUrl) {
	try {
		const parsed = new URL(rawUrl);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Vercel Internet Gateway
 * Acts as a proxy to allow the WebVM to look up external resources.
 *
 * Usage: POST /api/gateway
 * Body: { url: "https://google.com", method: "GET", headers: {}, body: null }
 * Header: x-api-key: <key>
 */
export async function POST({ request, url }) {
	const authKey = url.searchParams.get('api_key') || request.headers.get('x-api-key');

	if (!env.API_KEY) {
		return json({ error: 'Server configuration error: API_KEY not configured' }, { status: 500 });
	}

	if (!authKey) {
		return json({ error: 'Unauthorized: Missing API Key' }, { status: 401 });
	}

	if (authKey !== env.API_KEY) {
		return json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
	}

	try {
		const payload = await request.json();
		const targetUrl = payload.url;

		if (!targetUrl) {
			return json({ error: 'Missing target URL' }, { status: 400 });
		}

		if (!isAllowedUrl(targetUrl)) {
			return json({ error: 'Invalid URL protocol. Only http/https are supported.' }, { status: 400 });
		}

		console.log(`[Gateway] Proxying request to: ${targetUrl}`);

		const responseType = payload.responseType === 'arrayBuffer' ? 'arrayBuffer' : 'text';

		const controller = new AbortController();
		const timeoutMs = responseType === 'arrayBuffer' ? 60000 : 30000;
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const method = (payload.method || 'GET').toUpperCase();
		const headers = payload.headers && typeof payload.headers === 'object' ? { ...payload.headers } : {};

		if (!headers['User-Agent'] && !headers['user-agent']) {
			headers['User-Agent'] = 'Mozilla/5.0 (compatible; WebVMGateway/1.0)';
		}
		if (!headers['Accept'] && !headers['accept']) {
			headers['Accept'] = '*/*';
		}

		const response = await undiciFetch(targetUrl, {
			method,
			headers,
			body: method === 'GET' || method === 'HEAD' ? undefined : (payload.body || undefined),
			signal: controller.signal,
			dispatcher: proxyDispatcher || undefined
		});

		clearTimeout(timeoutId);

		if (responseType === 'arrayBuffer') {
			const buf = Buffer.from(await response.arrayBuffer());
			const b64 = buf.toString('base64');
			return json({
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers),
				data_b64: b64
			});
		}

		let data = await response.text();
		const shouldTruncate = payload.truncate !== false;
		const maxLength = Number.isFinite(payload.maxLength) ? payload.maxLength : 200000;
		if (shouldTruncate && data.length > maxLength) {
			data = data.substring(0, maxLength) + '\n\n[...TRUNCATED - Response too large...]';
		}

		return json({
			status: response.status,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers),
			data
		});
	} catch (err) {
		console.error('[Gateway] Proxy error:', err);
		return json({ error: err?.message || 'Gateway request failed' }, { status: 500 });
	}
}
