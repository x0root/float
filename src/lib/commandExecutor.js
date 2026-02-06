/**
 * Command Executor - Polls for pending commands and executes them in the VM
 * This runs client-side in the browser to bridge the API with the CheerpX VM
 */

import { browser } from '$app/environment';

let isPolling = false;
let pollInterval = null;
let term = null;
let apiKey = null;

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

/**
 * Initialize the command executor with the terminal instance
 * @param {Terminal} termInstance - The xterm.js terminal instance
 * @param {string} key - The API key for authentication
 */
export function initCommandExecutor(termInstance, key) {
    if (!browser) return;

    term = termInstance;
    apiKey = key;

    if (!isPolling) {
        startPolling();
    }
}

/**
 * Stop the command executor
 */
export function stopCommandExecutor() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    isPolling = false;
}

/**
 * Set or update the API key
 */
export function setExecutorApiKey(key) {
    apiKey = key;
}

/**
 * Start polling for pending commands
 */
function startPolling() {
    if (isPolling) return;
    isPolling = true;

    pollInterval = setInterval(pollForCommands, POLL_INTERVAL_MS);
    console.log('[CommandExecutor] Started polling for commands');
}

/**
 * Poll the API for pending commands
 */
async function pollForCommands() {
    if (!term || !apiKey) return;

    try {
        const response = await fetch(`/api?action=pending&api_key=${encodeURIComponent(apiKey)}`);
        if (!response.ok) {
            console.warn('[CommandExecutor] Failed to poll:', response.status);
            return;
        }

        const data = await response.json();
        if (data.commandId && data.cmd) {
            console.log('[CommandExecutor] Executing command:', data.cmd);
            await executeCommand(data.commandId, data.cmd);
        }
    } catch (err) {
        console.warn('[CommandExecutor] Poll error:', err.message);
    }
}

/**
 * Execute a command in the VM terminal and capture output
 * Uses explicit START/END wrappers to reliable capture output even with prompt echoes.
 */
async function executeCommand(commandId, cmd) {
    const startMarker = `__WVM_START_${commandId}__`;
    const endMarker = `__WVM_END_${commandId}__`;
    const buffer = term.buffer.active;

    // Capture starting line index (approximately where command starts)
    const startLine = buffer.baseY + buffer.cursorY;

    // Create a promise that resolves when markers are found
    const outputPromise = new Promise((resolve) => {
        let checkCount = 0;
        const maxChecks = 300; // 30 seconds

        const check = () => {
            const curLength = buffer.length;
            let foundStart = -1;
            let foundEnd = -1;

            // Scan from startLine to find our markers
            for (let i = startLine; i < curLength; i++) {
                // translateToString(true) trims right whitespace
                const line = buffer.getLine(i).translateToString(true, 0, term.cols).trim();

                // Strict equality ignores the input echo line (which contains 'echo "START"')
                // We only match the output line which is exactly "START"
                if (line === startMarker) foundStart = i;
                if (line === endMarker) foundEnd = i;
            }

            if (foundEnd !== -1) {
                // DEBUG: Log the relevant buffer slice
                if (foundStart !== -1) {
                    console.warn(`[CommandExecutor] DEBUG: Start found at ${foundStart}, End at ${foundEnd}`);
                    for (let i = foundStart; i <= foundEnd; i++) {
                        console.warn(`[CommandExecutor] DEBUG Line ${i}: ${JSON.stringify(buffer.getLine(i).translateToString(true, 0, term.cols))}`);
                    }
                } else {
                    console.warn('[CommandExecutor] DEBUG: Start Marker NOT FOUND');
                }

                // End found. Capture content.
                let capturedLines = [];
                // Only capture if we found the start (should always happen)
                if (foundStart !== -1) {
                    for (let i = foundStart + 1; i < foundEnd; i++) {
                        capturedLines.push(buffer.getLine(i).translateToString(true, 0, term.cols));
                    }
                }

                const rawOutput = capturedLines.join('\n');

                // CRITICAL: Strip ANSI escape codes
                // eslint-disable-next-line no-control-regex
                const cleanOutput = rawOutput
                    .replace(/\x1b\[[\d;]*[a-zA-Z]/g, '')
                    .replace(/\x1b\[.*?m/g, '');

                resolve(cleanOutput);
            } else {
                checkCount++;
                if (checkCount >= maxChecks) {
                    resolve('[Timeout] Marker not found');
                } else {
                    setTimeout(check, 100);
                }
            }
        };
        check();
    });

    // Run the wrapped command
    // "echo START; cmd; echo END"
    // We add a small delay to ensure previous prompt is clear
    await new Promise(r => setTimeout(r, 200));

    term.input(`echo "${startMarker}"; ${cmd}; echo "${endMarker}"\n`);

    const output = await outputPromise;

    // Send result
    try {
        await fetch(`/api?api_key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commandId: commandId,
                output: output,
                error: output === '[Timeout] Marker not found' ? 'Timeout' : '',
                exitCode: 0
            })
        });
        console.log('[CommandExecutor] Result sent for:', commandId);
    } catch (e) {
        console.error('[CommandExecutor] Failed to report result', e);
    }
}
