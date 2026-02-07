<script>
	export let form;
</script>

<div style="padding: 16px; max-width: 420px; margin: 0 auto;">
	<h1 style="margin: 0 0 12px 0;">Manager Login</h1>

	{#if form?.error}
		<div style="color: #b00020; margin-bottom: 10px;">{form.error}</div>
	{/if}

	<form method="POST" style="display:flex; flex-direction: column; gap: 10px;">
		<label style="display:flex; flex-direction: column; gap: 6px;">
			<span>Username</span>
			<input name="username" autocomplete="username" />
		</label>

		<label style="display:flex; flex-direction: column; gap: 6px;">
			<span>Password</span>
			<input name="password" type="password" autocomplete="current-password" />
		</label>

		<button type="submit">Login</button>
	</form>
</div>
