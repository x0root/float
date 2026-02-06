import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';

// In-memory command queue
// commandId -> { cmd, status: 'pending'|'running'|'completed'|'error', output, error, createdAt }
const commandQueue = new Map();

// Validate environment variables on module load
if (!env.API_KEY) {
    console.error('ERROR: API_KEY environment variable is not set');
}

if (!env.DISK_SOURCE) {
    console.warn('WARNING: DISK_SOURCE environment variable is not set');
}

/**
 * Validates the API key from the request
 */
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

/**
 * Generate a unique command ID
 */
function generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clean up old commands (older than 10 minutes)
 */
function cleanupOldCommands() {
    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();
    for (const [id, cmd] of commandQueue.entries()) {
        if (now - cmd.createdAt > TEN_MINUTES) {
            commandQueue.delete(id);
        }
    }
}

/**
 * GET /api
 * - With commandId: Get the result of a specific command
 * - With action=pending: Get the next pending command to execute (for client)
 * - Without params: List all commands (debug)
 */
export async function GET({ request, url }) {
    if (!env.API_KEY) {
        throw error(500, { message: 'Server configuration error: API_KEY not configured' });
    }

    if (!validateApiKey(request, url)) {
        throw error(401, { message: 'Unauthorized: Invalid or missing API key' });
    }

    cleanupOldCommands();

    const commandId = url.searchParams.get('commandId');
    const action = url.searchParams.get('action');

    // Get pending command for client to execute
    if (action === 'pending') {
        for (const [id, cmd] of commandQueue.entries()) {
            if (cmd.status === 'pending') {
                cmd.status = 'running';
                return json({
                    commandId: id,
                    cmd: cmd.cmd
                });
            }
        }
        // No pending commands
        return json({ commandId: null, cmd: null });
    }

    // Get specific command result
    if (commandId) {
        const cmd = commandQueue.get(commandId);
        if (!cmd) {
            throw error(404, { message: 'Command not found' });
        }
        return json({
            commandId,
            cmd: cmd.cmd,
            status: cmd.status,
            output: cmd.output || '',
            error: cmd.error || '',
            createdAt: cmd.createdAt,
            completedAt: cmd.completedAt
        });
    }

    // List all commands (debug)
    const commands = [];
    for (const [id, cmd] of commandQueue.entries()) {
        commands.push({
            commandId: id,
            cmd: cmd.cmd,
            status: cmd.status,
            createdAt: cmd.createdAt
        });
    }
    return json({ commands, diskSource: env.DISK_SOURCE });
}

/**
 * POST /api
 * - With cmd parameter: Submit a new command to the queue
 * - With commandId + result: Submit command result from client
 */
export async function POST({ request, url }) {
    if (!env.API_KEY) {
        throw error(500, { message: 'Server configuration error: API_KEY not configured' });
    }

    if (!validateApiKey(request, url)) {
        throw error(401, { message: 'Unauthorized: Invalid or missing API key' });
    }

    cleanupOldCommands();

    let body = {};
    try {
        body = await request.json();
    } catch {
        // Check URL params if no JSON body
    }

    const cmd = body.cmd || url.searchParams.get('cmd');
    const commandId = body.commandId || url.searchParams.get('commandId');

    // Client submitting result
    if (commandId && body.output !== undefined) {
        const command = commandQueue.get(commandId);
        if (!command) {
            throw error(404, { message: 'Command not found' });
        }
        command.status = body.exitCode === 0 ? 'completed' : 'error';
        command.output = body.output || '';
        command.error = body.error || '';
        command.exitCode = body.exitCode;
        command.completedAt = Date.now();

        return json({
            success: true,
            commandId,
            message: 'Result recorded'
        });
    }

    // New command submission
    if (!cmd) {
        throw error(400, { message: 'Bad Request: Missing required "cmd" parameter' });
    }

    const newCommandId = generateCommandId();
    commandQueue.set(newCommandId, {
        cmd: cmd,
        status: 'pending',
        output: null,
        error: null,
        createdAt: Date.now(),
        completedAt: null
    });

    // Check if client wants to wait (default: true)
    const shouldWait = url.searchParams.get('wait') !== 'false';

    if (shouldWait) {
        const startTime = Date.now();
        // Wait up to 60 seconds for completion
        while (Date.now() - startTime < 60000) {
            const currentCmd = commandQueue.get(newCommandId);
            if (currentCmd.status === 'completed' || currentCmd.status === 'error') {
                return json({
                    success: true,
                    commandId: newCommandId,
                    status: currentCmd.status,
                    output: currentCmd.output,
                    error: currentCmd.error,
                    exitCode: currentCmd.exitCode
                });
            }
            // Poll every 100ms
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return json({
        success: true,
        commandId: newCommandId,
        status: 'pending',
        message: 'Command queued (wait timed out). Poll GET /api?commandId=' + newCommandId + ' for results.',
        diskSource: env.DISK_SOURCE
    });
}
