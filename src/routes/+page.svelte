<script>
import WebVM from '$lib/WebVM.svelte';
import * as configObj from '/config_terminal';
import { tryPlausible } from '$lib/plausible.js';

export let data;

// Override the default disk configuration with the server-provided one
if (data && data.diskSource) {
    // We must clone/modify the object carefully if it's read-only, but usually module exports are not writable.
    // However, configObj is imported as * so it's a module namespace object (immutable).
    // We should create a copy to modify.
}

// Create a mutable copy of the config
const config = { ...configObj };
// Override
config.diskImageUrl = data.diskSource;

function handleProcessCreated(processCount)
{
	// Log the first 5 processes, to get an idea of the level of interaction from the public
	if(processCount <= 5)
	{
		tryPlausible(`Process started: ${processCount}`);
	}
}
</script>

<WebVM configObj={config} processCallback={handleProcessCreated} cacheId="blocks_terminal">
	<p>Looking for a complete desktop experience? Try the new <a class="underline" href="/alpine.html" target="_blank">Alpine Linux</a> graphical WebVM</p>
</WebVM>
