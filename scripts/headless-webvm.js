/**
 * Headless WebVM Runner
 * 
 * Runs WebVM in a headless Chrome browser to enable background command execution.
 * This allows the API to execute commands without needing a visible browser window.
 * 
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. Run this script: node scripts/headless-webvm.js
 *   3. Commands sent to the API will now execute in the background VM
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WEBVM_URL = process.env.WEBVM_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS !== 'false';

function readDotEnvApiKey() {
	try {
		const envPath = path.resolve(process.cwd(), '.env');
		if (!fs.existsSync(envPath)) return null;
		const raw = fs.readFileSync(envPath, 'utf8');
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const idx = trimmed.indexOf('=');
			if (idx === -1) continue;
			const key = trimmed.slice(0, idx).trim();
			if (key !== 'API_KEY') continue;
			let value = trimmed.slice(idx + 1).trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			return value || null;
		}
	} catch {
		return null;
	}
	return null;
}

const API_KEY = process.env.API_KEY || readDotEnvApiKey() || 'your-secret-api-key-here';
const WEBVM_ID = process.env.WEBVM_ID || `webvm_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const WEBVM_NAME = process.env.WEBVM_NAME || 'WebVM';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('🚀 Starting Headless WebVM...');
    console.log(`   URL: ${WEBVM_URL}`);
    console.log(`   Mode: ${HEADLESS ? 'Headless' : 'Visible'}`);
    console.log('');

    const browser = await puppeteer.launch({
        headless: HEADLESS,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--enable-features=SharedArrayBuffer',
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Ensure CommandExecutor has the API key before any app scripts run
    await page.evaluateOnNewDocument((key) => {
        try {
            // Per-tab marker: do not leak to normal user-opened tabs.
            sessionStorage.setItem('webvm-headless', 'true');
            localStorage.setItem('webvm-api-key', key);
        } catch {
            // ignore
        }
    }, API_KEY);

    // Track page errors but don't crash
    page.on('console', msg => {
        const text = msg.text();
        // Only log important messages
        if (text.includes('[CommandExecutor]')) {
            console.log(text);
        }
    });

    page.on('pageerror', error => {
        console.log(`[Page Error] ${error.message}`);
    });

    console.log('📡 Navigating to WebVM...');
    const targetUrl = (() => {
        try {
            const u = new URL(WEBVM_URL);
            u.searchParams.set('headless', '1');
            return u.toString();
        } catch {
            // Fallback for non-absolute URLs
            return WEBVM_URL.includes('?') ? `${WEBVM_URL}&headless=1` : `${WEBVM_URL}?headless=1`;
        }
    })();

    // Navigate with retry logic
    let loaded = false;
    for (let attempt = 1; attempt <= 3 && !loaded; attempt++) {
        try {
            await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            loaded = true;
            console.log('✅ Page loaded successfully');
        } catch (error) {
            console.log(`⚠️  Attempt ${attempt}/3 failed: ${error.message}`);
            if (attempt < 3) {
                console.log('   Retrying in 3 seconds...');
                await sleep(3000);
            }
        }
    }

    if (!loaded) {
        console.error('❌ Failed to load WebVM after 3 attempts');
        console.log('   Make sure the dev server is running: npm run dev');
        await browser.close();
        process.exit(1);
    }

    console.log('🔑 API key configured');

    async function agentHeartbeat() {
        try {
            const base = WEBVM_URL.replace(/\/$/, '');
            const agentUrl = `${base}/api/manager/webvm/agent?api_key=${encodeURIComponent(API_KEY)}`;
            const res = await fetch(agentUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: WEBVM_ID,
                    name: WEBVM_NAME,
                    runAt: base,
                    api: `${base}/api`,
                    meta: { headless: HEADLESS }
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return;
            const commands = data?.commands || [];
            if (commands.some((c) => c?.type === 'terminate')) {
                console.log('[Headless] Terminate requested by manager');
                await browser.close();
                process.exit(0);
            }
        } catch {
            // ignore
        }
    }

    // Start heartbeating immediately (so /manager can see the instance even during boot)
    await agentHeartbeat();
    const agentInterval = setInterval(agentHeartbeat, 3000);

    // Wait for terminal with retry
    console.log('⏳ Waiting for terminal to initialize...');
    try {
        await page.waitForSelector('#console', { timeout: 30000 });
        console.log('✅ Terminal element found');
    } catch (error) {
        console.error('❌ Terminal not found, continuing anyway...');
    }

    // Wait for VM to boot - use a safer approach
    console.log('⏳ Waiting for CheerpX VM to boot (this may take 30-60 seconds)...');

    let vmReady = false;
    for (let i = 0; i < 90; i++) { // Wait up to 90 seconds
        await sleep(1000);

        try {
            // Safely check for terminal content
            const terminalContent = await page.evaluate(() => {
                const consoleEl = document.querySelector('#console');
                return consoleEl ? consoleEl.innerText || consoleEl.textContent : '';
            }).catch(() => '');

            // Look for bash prompt
            if (terminalContent.includes('user@') ||
                terminalContent.includes('$ ') ||
                terminalContent.includes('# ') ||
                terminalContent.includes('bash')) {
                vmReady = true;
                console.log('✅ VM appears to be ready (bash prompt detected)');
                break;
            }
        } catch (e) {
            // Context may be destroyed during navigation, just continue
        }

        if (i > 0 && i % 15 === 0) {
            console.log(`   Still waiting... (${i}s)`);
        }
    }

    if (!vmReady) {
        console.log('⚠️  Could not confirm VM readiness after 90s, but continuing...');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🖥️  HEADLESS WEBVM IS RUNNING');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  The VM is now running in the background.');
    console.log('  Commands sent to the API will be executed automatically.');
    console.log('');
    console.log('  Test with:');
    const testUrl = WEBVM_URL.replace(/\/$/, '');
    console.log(`    curl -X POST "${testUrl}/api?api_key=${API_KEY}" \\`);
    console.log(`      -H "Content-Type: application/json" -d '{"cmd":"whoami"}'`);
    console.log('');
    console.log('  Press Ctrl+C to stop.');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

    // Keep alive with periodic health checks
    const healthCheck = setInterval(async () => {
        try {
            const url = page.url();
            if (!url.includes('localhost')) {
                console.log('⚠️  Page navigated away, attempting to return...');
                await page.goto(targetUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
            }
        } catch (e) {
            // Ignore errors in health check
        }
    }, 10000);

    process.on('SIGINT', async () => {
        console.log('\n👋 Shutting down headless WebVM...');
        clearInterval(agentInterval);
        clearInterval(healthCheck);
        await browser.close();
        process.exit(0);
    });

    // Keep running
    await new Promise(() => { });
}

main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
});
