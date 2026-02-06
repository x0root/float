<script>
    import { onMount } from 'svelte';

    let cmd = '';
    let outputLog = [];
    let history = [];
    let historyIndex = -1;
    let apiKey = '';
    let inputEl;

    onMount(() => {
        // Try to find API key from localStorage or .env (not accessible here client-side easily without setup)
        // We will ask user to input it if missing, or default to placeholder
        const savedKey = localStorage.getItem('webvm-api-key');
        if (savedKey) apiKey = savedKey;
        inputEl.focus();
    });

    function addToLog(type, text) {
        outputLog = [...outputLog, { type, text, time: new Date().toLocaleTimeString() }];
        // Auto scroll
        setTimeout(() => {
            const container = document.getElementById('terminal-output');
            if (container) container.scrollTop = container.scrollHeight;
        }, 10);
    }

    async function execute() {
        if (!cmd.trim()) return;

        const command = cmd;
        history.push(command);
        historyIndex = history.length;
        
        addToLog('command', `$ ${command}`);
        cmd = '';

        if (command === 'clear') {
            outputLog = [];
            return;
        }

        try {
            addToLog('info', 'Executing...');
            
            // Allow user to set key in UI
            if (!apiKey) {
                addToLog('error', 'Error: API Key not set. Please enter securely above.');
                return;
            }
            localStorage.setItem('webvm-api-key', apiKey);

            const res = await fetch(`/api?api_key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cmd: command })
            });

            const data = await res.json();

            if (data.success) {
                if (data.output) addToLog('output', data.output);
                if (data.error) addToLog('error', data.error);
                if (!data.output && !data.error) addToLog('info', '[No Output]');
            } else {
                addToLog('error', `API Error: ${data.message || 'Unknown error'}`);
            }
        } catch (e) {
            addToLog('error', `Network Error: ${e.message}`);
        }
    }

    function handleKey(e) {
        if (e.key === 'Enter') {
            execute();
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                cmd = history[historyIndex];
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                cmd = history[historyIndex];
            } else {
                historyIndex = history.length;
                cmd = '';
            }
            e.preventDefault();
        }
    }
</script>

<div class="bg-gray-900 text-gray-100 min-h-screen p-4 font-mono flex flex-col">
    <div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <h1 class="text-xl font-bold text-green-400">WebVM Remote Console</h1>
        <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400">API Key:</span>
            <input 
                type="password" 
                bind:value={apiKey} 
                class="bg-gray-800 border border-gray-600 px-2 py-1 rounded text-sm w-32 focus:w-64 transition-all"
                placeholder="Enter API Key"
            />
        </div>
    </div>

    <div id="terminal-output" class="flex-1 overflow-y-auto whitespace-pre-wrap mb-4 font-mono text-sm">
        {#if outputLog.length === 0}
            <div class="text-gray-500">
                Welcome to WebVM Remote Console.
                Enter commands below to execute them on the backend Headless VM.
                Try: 'whoami', 'ls -la', 'cat /etc/os-release'
            </div>
        {/if}
        {#each outputLog as log}
            <div class="mb-1">
                {#if log.type === 'command'}
                    <span class="text-yellow-400 font-bold">{log.text}</span>
                {:else if log.type === 'error'}
                    <span class="text-red-400">{log.text}</span>
                {:else if log.type === 'info'}
                    <span class="text-blue-400 italic text-xs">{log.text}</span>
                {:else}
                    <span class="text-gray-200">{log.text}</span>
                {/if}
            </div>
        {/each}
    </div>

    <div class="flex gap-2 items-center bg-gray-800 p-2 rounded">
        <span class="text-green-500 font-bold">$</span>
        <input 
            bind:this={inputEl}
            bind:value={cmd} 
            on:keydown={handleKey}
            class="flex-1 bg-transparent border-none outline-none text-white font-mono"
            placeholder="Type command..."
        />
        <button on:click={execute} class="bg-green-600 hover:bg-green-700 px-4 py-1 rounded text-white text-sm font-bold">
            Run
        </button>
    </div>
</div>
