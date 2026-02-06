<script>
  import { files as uploadedFiles } from './activities.js';

  export let cx = null; // The main CheerpX runtime object
  let inputElement = null;
  let feedbackMessage = '';
  let isError = false;

  async function handleFileSelected(event) {
    feedbackMessage = '';
    isError = false;
    const files = event.target.files;
    if (!files.length) return;

    if (!cx) {
      feedbackMessage = 'VM is not ready. Please wait a moment and try again.';
      isError = true;
      return;
    }

    // Handle one file at a time for simplicity
    const file = files[0];
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, ''); // Sanitize filename

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target.result;
          const base64String = dataUrl.split(',')[1];

          // Use cx.run to execute a command that creates the file inside the VM
          // We will write to the /tmp/ directory, which is always world-writable.
          const command = `echo '${base64String}' | base64 -d > /tmp/${fileName}`;
          
          // The cx.run command for something simple like this is very fast
          // and doesn't require complex output handling.
          await cx.run('/bin/bash', ['-c', command]);

          feedbackMessage = `Success! "${fileName}" is now available in /tmp/`;
          isError = false;

          // Update the UI list
          uploadedFiles.update(currentFiles => {
            if (!currentFiles.some(f => f.name === fileName)) {
              return [...currentFiles, { name: fileName, size: file.size }];
            }
            return currentFiles;
          });

        } catch (runError) {
          console.error('cx.run failed:', runError);
          feedbackMessage = `Failed to execute command in VM: ${runError.message}`;
          isError = true;
        }
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        feedbackMessage = 'Failed to read the selected file.';
        isError = true;
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(`Failed to read file: ${file.name}`, e);
      feedbackMessage = `Error reading file: ${e.message}`;
      isError = true;
    }
  }
</script>

<div class="flex flex-col gap-3">
    <h2 class="text-xl font-bold">File Uploader</h2>
    <p class="text-sm">Upload a file to the VM's temporary directory (<code class="bg-neutral-700 p-1 rounded">/tmp/</code>).</p>

    <input
      type="file"
      class="hidden"
      bind:this={inputElement}
      on:change={handleFileSelected}
    />
    <button
      class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full disabled:bg-gray-500 disabled:cursor-not-allowed"
      disabled={!cx}
      on:click={() => inputElement && inputElement.click()}
      title={!cx ? 'Waiting for VM to initialize...' : 'Upload File'}
    >
      Select File to Upload
    </button>

	{#if feedbackMessage}
		<div class:bg-red-800={isError} class:bg-green-800={!isError} class="border text-white text-sm p-2 rounded" class:border-red-600={isError} class:border-green-600={!isError}>
			<p>{feedbackMessage}</p>
		</div>
	{/if}

    <h3 class="text-lg font-semibold mt-2">Uploaded Files:</h3>
    <div class="flex flex-col gap-2 bg-neutral-700 p-2 rounded max-h-48 overflow-y-auto">
        {#if $uploadedFiles.length === 0}
            <p class="text-sm text-gray-400">No files uploaded yet.</p>
        {:else}
            {#each $uploadedFiles as file}
                <div class="flex justify-between items-center text-sm">
                    <span class="truncate">{file.name}</span>
                    <span class="text-gray-400 flex-shrink-0">({(file.size / 1024).toFixed(2)} KB)</span>
                </div>
            {/each}
        {/if}
    </div>
</div>
