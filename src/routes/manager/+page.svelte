<script>
	import { onMount } from 'svelte';

	let webvm = [];
	let webvmError = '';
	let loadingWebvm = false;
	let managerApiKey = '';

	let renameId = '';
	let renameValue = '';

	// Create VM form state
	let showCreateForm = false;
	let createName = '';
	let createPort = '';
	let createDiskSource = '';
	let creating = false;
	let createError = '';

	async function loadWebvm() {
		loadingWebvm = true;
		webvmError = '';
		try {
			const res = await fetch('/api/manager/webvm');
			const data = await res.json();
			if (!res.ok) {
				webvmError = data?.message || 'Failed to load WebVM instances';
				webvm = [];
				managerApiKey = '';
				return;
			}
			webvm = data?.instances || [];
			managerApiKey = (data?.apiKey || '').toString();
		} catch (e) {
			webvmError = e?.message || 'Failed to load WebVM instances';
			webvm = [];
			managerApiKey = '';
		} finally {
			loadingWebvm = false;
		}
	}

	function startRename(id, current) {
		renameId = id;
		renameValue = current;
	}

	async function webvmAction(action, id, newName) {
		const body = { action, id };
		if (action === 'rename') body.newName = newName;
		const res = await fetch('/api/manager/webvm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			throw new Error(data?.message || 'Action failed');
		}
	}

	async function createInstance() {
		creating = true;
		createError = '';
		try {
			const body = {
				action: 'create',
				name: createName.trim() || 'WebVM',
				port: createPort ? parseInt(createPort) : 0,
				diskSource: createDiskSource.trim()
			};
			const res = await fetch('/api/manager/webvm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = await res.json();
			if (!res.ok) {
				createError = data?.message || 'Failed to create VM';
				return;
			}
			// Reset form and refresh
			showCreateForm = false;
			createName = '';
			createPort = '';
			createDiskSource = '';
			await loadWebvm();
		} catch (e) {
			createError = e?.message || 'Failed to create VM';
		} finally {
			creating = false;
		}
	}

	async function terminateInstance(id) {
		try {
			await webvmAction('terminate', id);
			await loadWebvm();
		} catch (e) {
			webvmError = e?.message || 'Failed to terminate WebVM';
		}
	}

	async function startInstance(id) {
		try {
			await webvmAction('start', id);
			await loadWebvm();
		} catch (e) {
			webvmError = e?.message || 'Failed to start WebVM';
		}
	}

	async function deleteInstance(id) {
		try {
			await webvmAction('delete', id);
			await loadWebvm();
		} catch (e) {
			webvmError = e?.message || 'Failed to delete WebVM';
		}
	}

	async function applyRename() {
		try {
			await webvmAction('rename', renameId, renameValue);
			renameId = '';
			renameValue = '';
			await loadWebvm();
		} catch (e) {
			webvmError = e?.message || 'Failed to rename WebVM';
		}
	}

	async function logout() {
		await fetch('/api/manager/logout', { method: 'POST' });
		window.location.href = '/manager/login';
	}

	onMount(async () => {
		await loadWebvm();
	});
</script>

<div style="padding: 16px; max-width: 1100px; margin: 0 auto;">
	<div style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
		<h1 style="margin: 0;">Manager</h1>
		<button on:click={logout}>Logout</button>
	</div>

	<section style="margin-top: 20px;">
		<div style="display:flex; align-items:center; justify-content:space-between; gap: 12px;">
			<h2 style="margin: 0;">WebVM instances</h2>
			<div style="display:flex; gap: 8px;">
				<button on:click={() => showCreateForm = !showCreateForm}>{showCreateForm ? 'Cancel' : 'Create VM'}</button>
				<button on:click={loadWebvm} disabled={loadingWebvm}>Refresh</button>
			</div>
		</div>

		{#if showCreateForm}
			<div style="margin-top: 12px; border: 1px solid #ccc; padding: 12px;">
				<h3 style="margin: 0 0 12px 0;">Create New VM</h3>
				{#if createError}
					<div style="color: #b00020; margin-bottom: 10px;">{createError}</div>
				{/if}
				<div style="display:flex; flex-direction: column; gap: 10px;">
					<label style="display:flex; flex-direction: column; gap: 4px;">
						<span>Name</span>
						<input bind:value={createName} placeholder="WebVM-1" />
					</label>
					<label style="display:flex; flex-direction: column; gap: 4px;">
						<span>Port (optional, auto if empty)</span>
						<input bind:value={createPort} type="number" placeholder="5637" />
					</label>
					<label style="display:flex; flex-direction: column; gap: 4px;">
						<span>Disk Source (optional, uses .env if empty)</span>
						<input bind:value={createDiskSource} placeholder="wss://disks.webvm.io/..." />
					</label>
					<div style="display:flex; gap: 8px; margin-top: 8px;">
						<button on:click={createInstance} disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
						<button on:click={() => { showCreateForm = false; createError = ''; }}>Cancel</button>
					</div>
				</div>
			</div>
		{/if}

		{#if loadingWebvm}
			<div>Loading...</div>
		{:else if webvmError}
			<div style="color: #b00020;">{webvmError}</div>
		{:else}
			<table style="width:100%; border-collapse: collapse; margin-top: 12px;">
				<thead>
					<tr>
						<th style="text-align:left; border-bottom: 1px solid #ccc; padding: 8px;">Status</th>
						<th style="text-align:left; border-bottom: 1px solid #ccc; padding: 8px;">Name</th>
						<th style="text-align:left; border-bottom: 1px solid #ccc; padding: 8px;">Run at</th>
						<th style="text-align:left; border-bottom: 1px solid #ccc; padding: 8px;">API</th>
						<th style="text-align:left; border-bottom: 1px solid #ccc; padding: 8px;">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each webvm as inst}
						<tr>
							<td style="border-bottom: 1px solid #eee; padding: 8px;">{inst.online ? 'Online' : 'Offline'}</td>
							<td style="border-bottom: 1px solid #eee; padding: 8px;">{inst.name}</td>
							<td style="border-bottom: 1px solid #eee; padding: 8px;">
								{#if managerApiKey && inst.runAt}
									<a href={`${inst.runAt}?api_key=${encodeURIComponent(managerApiKey)}`} target="_blank" rel="noreferrer">{inst.runAt}</a>
								{:else}
									{inst.runAt}
								{/if}
							</td>
							<td style="border-bottom: 1px solid #eee; padding: 8px;">{inst.api}</td>
							<td style="border-bottom: 1px solid #eee; padding: 8px; display:flex; gap: 8px; flex-wrap: wrap;">
								<button on:click={() => startInstance(inst.id)} disabled={inst.online}>Start</button>
								<button on:click={() => terminateInstance(inst.id)} disabled={!inst.online && !inst.runAt}>Terminate</button>
								<button on:click={() => deleteInstance(inst.id)}>Delete</button>
								<button on:click={() => startRename(inst.id, inst.name)}>Rename</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if renameId}
			<div style="margin-top: 12px; border: 1px solid #ccc; padding: 12px;">
				<div style="display:flex; gap: 8px; align-items:center; flex-wrap: wrap;">
					<div style="min-width: 80px;">Rename:</div>
					<input bind:value={renameValue} placeholder="new name" />
					<button on:click={applyRename} disabled={!renameValue.trim()}>Apply</button>
					<button on:click={() => { renameId = ''; renameValue = ''; }}>Cancel</button>
				</div>
			</div>
		{/if}
	</section>
</div>
