import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

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

        console.log(`[Gateway] Proxying request to: ${targetUrl}`);

        const responseType = payload.responseType === 'arrayBuffer' ? 'arrayBuffer' : 'text';

        // Add timeout for faster response
        const controller = new AbortController();
        const timeoutMs = responseType === 'arrayBuffer' ? 60000 : 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Perform the server-side fetch (Running on Vercel/Node)
        const method = (payload.method || 'GET').toUpperCase();
        const headers = payload.headers && typeof payload.headers === 'object' ? { ...payload.headers } : {};

        // Provide conservative defaults to increase success rate with common sites.
        if (!headers['User-Agent'] && !headers['user-agent']) {
            headers['User-Agent'] = 'Mozilla/5.0 (compatible; WebVMGateway/1.0)';
        }
        if (!headers['Accept'] && !headers['accept']) {
            headers['Accept'] = '*/*';
        }

        const response = await fetch(targetUrl, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : (payload.body || undefined),
            signal: controller.signal
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

        // Read response body as text
        let data = await response.text();

        // Truncate large responses for faster terminal output (can be disabled by caller)
        const shouldTruncate = payload.truncate !== false;
        const MAX_LENGTH = Number.isFinite(payload.maxLength) ? payload.maxLength : 200000;
        if (shouldTruncate && data.length > MAX_LENGTH) {
            data = data.substring(0, MAX_LENGTH) + "\n\n[...TRUNCATED - Response too large...]";
        }

        return json({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data
        });

    } catch (err) {
        console.error('[Gateway] Proxy error:', err);
        return json({ error: err.message }, { status: 500 });
    }
}
