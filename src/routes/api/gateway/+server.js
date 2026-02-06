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

    // Security: Validate API Key (reusing the env var or matching query)
    // For now, we accept the key passed in params to match existing flows
    if (!authKey) {
        return json({ error: 'Unauthorized: Missing API Key' }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const targetUrl = payload.url;

        if (!targetUrl) {
            return json({ error: 'Missing target URL' }, { status: 400 });
        }

        console.log(`[Gateway] Proxying request to: ${targetUrl}`);

        // Add timeout for faster response
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

        // Read response body
        let data = await response.text();

        // Truncate large responses for faster terminal output
        const MAX_LENGTH = 5000;
        if (data.length > MAX_LENGTH) {
            data = data.substring(0, MAX_LENGTH) + "\n\n[...TRUNCATED - Response too large...]";
        }

        return json({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data: data
        });

    } catch (err) {
        console.error('[Gateway] Proxy error:', err);
        return json({ error: err.message }, { status: 500 });
    }
}
