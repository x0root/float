<script>
	import { onMount, tick } from 'svelte';
	import { get } from 'svelte/store';
	import SideBar from '$lib/SideBar.svelte';
	import '$lib/global.css';
	import '@xterm/xterm/css/xterm.css'
	import '@fortawesome/fontawesome-free/css/all.min.css'
	import { cpuActivity, diskActivity, cpuPercentage, diskLatency } from '$lib/activities.js'
	import { introMessage, errorMessage, unexpectedErrorMessage } from '$lib/messages.js'
	import { tryPlausible } from '$lib/plausible.js'
	import { initCommandExecutor } from '$lib/commandExecutor.js'
	import { WVM_CLIENT_SCRIPT } from '$lib/rpc_scripts.js';
	import { NET_GATEWAY_SCRIPT } from '$lib/net_gateway.js';

	export let configObj = null;
	export let processCallback = null;
	export let cacheId = null;
	export let cpuActivityEvents = [];
	export let diskLatencies = [];
	export let activityEventsInterval = 0;

	var term = null;
	var cx = null;
	var fitAddon = null;
	var cxReadFunc = null;
	var blockCache = null;
	var processCount = 0;
	var curVT = 0;
	var sideBarPinned = false;
	var dataDevice = null;

	// RPC State
	let scriptsInstalled = false;
	let scriptsInstalling = false;
	let netBannerPrinted = false;
	let fetchMarkerBuffer = "";

	function writeData(buf, vt)
	{
		if(vt != 1)
			return;

		try {
			const str = new TextDecoder().decode(buf);

			// Prompt Detection for Installer
			if (!scriptsInstalled && !scriptsInstalling && (str.includes("user@") || str.includes("root@") || str.includes(":~$"))) {
				console.log("[WebVM] Prompt detected. Installing scripts...");
				installRPCScripts();
			}

			// Fetch Interceptor - robust to marker split across output chunks.
			fetchMarkerBuffer += str;
			// Keep the rolling buffer bounded to avoid unbounded growth.
			if (fetchMarkerBuffer.length > 20000) {
				fetchMarkerBuffer = fetchMarkerBuffer.slice(-20000);
			}

			while (true) {
				const startText = fetchMarkerBuffer.indexOf("__FETCH__");
				const startB64 = fetchMarkerBuffer.indexOf("__FETCH_B64__");
				const startHead = fetchMarkerBuffer.indexOf("__FETCH_HEAD__");
				if (startText === -1 && startB64 === -1 && startHead === -1) break;

				let isB64 = false;
				let startIdx = startText;
				let endMarker = "__ENDFETCH__";
				let startMarker = "__FETCH__";
				let method = 'GET';
				let returnHeadersOnly = false;
				if (startHead !== -1 && (startText === -1 || startHead < startText) && (startB64 === -1 || startHead < startB64)) {
					startIdx = startHead;
					startMarker = "__FETCH_HEAD__";
					endMarker = "__ENDFETCH_HEAD__";
					method = 'HEAD';
					returnHeadersOnly = true;
				} else if (startB64 !== -1 && (startText === -1 || startB64 < startText)) {
					isB64 = true;
					startIdx = startB64;
					startMarker = "__FETCH_B64__";
					endMarker = "__ENDFETCH_B64__";
				}

				const endIdx = fetchMarkerBuffer.indexOf(endMarker, startIdx);
				if (endIdx === -1) break;

				const url = fetchMarkerBuffer.slice(startIdx + startMarker.length, endIdx);
				console.log("[WebVM] Intercepted fetch request:", url, isB64 ? "(b64)" : (method === 'HEAD' ? "(head)" : "(text)"));
				handleFetch(url, { responseType: isB64 ? 'arrayBuffer' : 'text', method, returnHeadersOnly });

				fetchMarkerBuffer = fetchMarkerBuffer.slice(endIdx + endMarker.length);
			}
		} catch (e) {}

		term.write(new Uint8Array(buf));
	}

	async function handleFetch(url, opts = {}) {
		try {
			const apiKey = localStorage.getItem('webvm-api-key');
			const gatewayUrl = apiKey ? `/api/gateway?api_key=${encodeURIComponent(apiKey)}` : '/api/gateway';
			const res = await fetch(gatewayUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url, method: opts.method || 'GET', responseType: opts.responseType || 'text' })
			});
			const data = await res.json();

			if (opts.responseType === 'arrayBuffer') {
				const content = data.data_b64 || data.error || "";
				term.input(content + "__ENDRESPONSE__\n");
				return;
			}

			if (opts.returnHeadersOnly) {
				const headers = data.headers && typeof data.headers === 'object' ? data.headers : {};
				let out = `${data.status || ''} ${data.statusText || ''}`.trim() + "\n";
				for (const [k, v] of Object.entries(headers)) {
					out += `${k}: ${v}\n`;
				}
				term.input(out + "__ENDRESPONSE__\n");
				return;
			}

			// Send response directly - text mode
			const content = data.data || data.error || "Error fetching URL";
			term.input(content + "__ENDRESPONSE__\n");
		} catch (e) {
			console.error("[WebVM] Fetch error:", e);
			term.input("Error: " + e.message + "__ENDRESPONSE__\n");
		}
	}

	async function installRPCScripts() {
		if (!cx) return;
		if (scriptsInstalled || scriptsInstalling) return;
		scriptsInstalling = true;
		
		try {
			// Create unified net gateway script + curl/wget shims.
			const netB64 = btoa(NET_GATEWAY_SCRIPT);
			await cx.run('/bin/bash', ['-c', `
				echo "${netB64}" | base64 -d > /tmp/net && chmod +x /tmp/net &&
				printf '#!/bin/sh\nexec /tmp/net curl "$@"\n' > /tmp/curl && chmod +x /tmp/curl &&
				printf '#!/bin/sh\nexec /tmp/net wget "$@"\n' > /tmp/wget && chmod +x /tmp/wget
			`]);

			// Apply PATH update immediately in the active shell session.
			term.input('export PATH=/tmp:$PATH\n');
			
			if (!netBannerPrinted) {
				netBannerPrinted = true;
				term.write('\r\n========================================\r\n');
				term.write('Network ready! You can use curl/wget directly:\r\n');
				term.write('  curl -I google.com\r\n');
				term.write('  curl -O https://example.com/file.bin\r\n');
				term.write('  wget -O out.html google.com\r\n');
				term.write('\r\nCompatibility wrapper also available:\r\n');
				term.write('  /tmp/net curl [-I|-o out|-O] <url>\r\n');
				term.write('  /tmp/net wget [-O out] <url>\r\n');
				term.write('========================================\r\n');
			}
			scriptsInstalled = true;
		} catch (e) {
			console.error('Failed to install network script:', e);
			term.write('\r\nWarning: Network tools installation failed\r\n');
		} finally {
			scriptsInstalling = false;
		}
	}

	function readData(str)
	{
		if(cxReadFunc == null)
			return;
		for(var i=0;i<str.length;i++)
			cxReadFunc(str.charCodeAt(i));
	}
	function printMessage(msg)
	{
		for(var i=0;i<msg.length;i++)
			term.write(msg[i] + "\n");
	}
	function expireEvents(list, curTime, limitTime)
	{
		while(list.length > 1)
		{
			if(list[1].t < limitTime)
				list.shift();
			else
				break;
		}
	}
	function cleanupEvents()
	{
		var curTime = Date.now();
		var limitTime = curTime - 10000;
		expireEvents(cpuActivityEvents, curTime, limitTime);
		computeCpuActivity(curTime, limitTime);
		if(cpuActivityEvents.length == 0)
		{
			clearInterval(activityEventsInterval);
			activityEventsInterval = 0;
		}
	}
	function computeCpuActivity(curTime, limitTime)
	{
		var totalActiveTime = 0;
		var lastActiveTime = limitTime;
		var lastWasActive = false;
		for(var i=0;i<cpuActivityEvents.length;i++)
		{
			var e = cpuActivityEvents[i];
			var eTime = e.t;
			if(eTime < limitTime)
				eTime = limitTime;
			if(e.state == "ready")
			{
				totalActiveTime += (eTime - lastActiveTime);
				lastWasActive = false;
			}
			else
			{
				lastActiveTime = eTime;
				lastWasActive = true;
			}
		}
		if(lastWasActive)
			totalActiveTime += (curTime - lastActiveTime);
		cpuPercentage.set(Math.ceil((totalActiveTime / 10000) * 100));
	}
	function hddCallback(state)
	{
		diskActivity.set(state != "ready");
	}
	function latencyCallback(latency)
	{
		diskLatencies.push(latency);
		if(diskLatencies.length > 30)
			diskLatencies.shift();
		var total = 0;
		for(var i=0;i<diskLatencies.length;i++)
			total += diskLatencies[i];
		var avg = total / diskLatencies.length;
		diskLatency.set(Math.ceil(avg));
	}
	function cpuCallback(state)
	{
		cpuActivity.set(state != "ready");
		var curTime = Date.now();
		var limitTime = curTime - 10000;
		expireEvents(cpuActivityEvents, curTime, limitTime);
		cpuActivityEvents.push({t: curTime, state: state});
		computeCpuActivity(curTime, limitTime);
		if(activityEventsInterval != 0)
			clearInterval(activityEventsInterval);
		activityEventsInterval = setInterval(cleanupEvents, 2000);
	}
	function computeXTermFontSize()
	{
		return parseInt(getComputedStyle(document.body).fontSize);
	}
	function setScreenSize(display)
	{
		var internalMult = 1.0;
		var displayWidth = display.offsetWidth;
		var displayHeight = display.offsetHeight;
		var minWidth = 1024;
		var minHeight = 768;
		if(displayWidth < minWidth)
			internalMult = minWidth / displayWidth;
		if(displayHeight < minHeight)
			internalMult = Math.max(internalMult, minHeight / displayHeight);
		var internalWidth = Math.floor(displayWidth * internalMult);
		var internalHeight = Math.floor(displayHeight * internalMult);
		cx.setKmsCanvas(display, internalWidth, internalHeight);
		var screenshotMult = 1.0;
		var maxWidth = 1024;
		var maxHeight = 768;
		if(internalWidth > maxWidth)
			screenshotMult = maxWidth / internalWidth;
		if(internalHeight > maxHeight)
			screenshotMult = Math.min(screenshotMult, maxHeight / internalHeight);
		var screenshotWidth = Math.floor(internalWidth * screenshotMult);
		var screenshotHeight = Math.floor(internalHeight * screenshotMult);
	}
	var curInnerWidth = 0;
	var curInnerHeight = 0;
	function handleResize()
	{
		if(curInnerWidth == window.innerWidth && curInnerHeight == window.innerHeight)
			return;
		curInnerWidth = window.innerWidth;
		curInnerHeight = window.innerHeight;
		triggerResize();
	}
	function triggerResize()
	{
		term.options.fontSize = computeXTermFontSize();
		fitAddon.fit();
		const display = document.getElementById("display");
		if(display)
			setScreenSize(display);
	}
	async function initTerminal()
	{
		const { Terminal } = await import('@xterm/xterm');
		const { FitAddon } = await import('@xterm/addon-fit');
		const { WebLinksAddon } = await import('@xterm/addon-web-links');
		term = new Terminal({cursorBlink:true, convertEol:true, fontFamily:"monospace", fontWeight: 400, fontWeightBold: 700, fontSize: computeXTermFontSize()});
		fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		var linkAddon = new WebLinksAddon();
		term.loadAddon(linkAddon);
		const consoleDiv = document.getElementById("console");
		term.open(consoleDiv);
		term.scrollToTop();
		fitAddon.fit();
		window.addEventListener("resize", handleResize);
		term.focus();
		term.onData(readData);
		function preventDefaults (e) {
			e.preventDefault()
			e.stopPropagation()
		}
		consoleDiv.addEventListener("dragover", preventDefaults, false);
		consoleDiv.addEventListener("dragenter", preventDefaults, false);
		consoleDiv.addEventListener("dragleave", preventDefaults, false);
		consoleDiv.addEventListener("drop", preventDefaults, false);
		curInnerWidth = window.innerWidth;
		curInnerHeight = window.innerHeight;
		if(configObj.printIntro)
			printMessage(introMessage);
		try
		{
			await initCheerpX();
		}
		catch(e)
		{
			printMessage(unexpectedErrorMessage);
			printMessage([e.toString()]);
			return;
		}
	}
	function handleActivateConsole(vt)
	{
		if(curVT == vt)
			return;
		curVT = vt;
		if(vt != 7)
			return;
		const display = document.getElementById("display");
		display.parentElement.style.zIndex = 5;
		tryPlausible("Display activated");
	}
	function handleProcessCreated()
	{
		processCount++;
		if(processCallback)
			processCallback(processCount);
	}
	async function initCheerpX()
	{
		const CheerpX = await import('@leaningtech/cheerpx');
		var blockDevice = null;
		switch(configObj.diskImageType)
		{
			case "cloud":
				blockDevice = await CheerpX.CloudDevice.create(configObj.diskImageUrl);
				break;
			case "bytes":
				blockDevice = await CheerpX.HttpBytesDevice.create(configObj.diskImageUrl);
				break;
			case "github":
				blockDevice = await CheerpX.GitHubDevice.create(configObj.diskImageUrl);
				break;
			default:
				throw new Error("Unrecognized device type");
		}
		blockCache = await CheerpX.IDBDevice.create(cacheId);
		var overlayDevice = await CheerpX.OverlayDevice.create(blockDevice, blockCache);
		var webDevice = await CheerpX.WebDevice.create("");
		var documentsDevice = await CheerpX.WebDevice.create("documents");
		dataDevice = await CheerpX.DataDevice.create();
		var mountPoints = [
			{type:"ext2", dev:overlayDevice, path:"/"},
			{type:"dir", dev:webDevice, path:"/web"},
			{type:"dir", dev:dataDevice, path:"/data"},
			{type:"devs", path:"/dev"},
			{type:"devpts", path:"/dev/pts"},
			{type:"proc", path:"/proc"},
			{type:"sys", path:"/sys"},
			{type:"dir", dev:documentsDevice, path:"/home/user/documents"}
		];
		try
		{
			const newCx = await CheerpX.Linux.create({mounts: mountPoints});
			cx = newCx;
		}
		catch(e)
		{
			printMessage(errorMessage);
			printMessage([e.toString()]);
			return;
		}
		cx.registerCallback("cpuActivity", cpuCallback);
		cx.registerCallback("diskActivity", hddCallback);
		cx.registerCallback("diskLatency", latencyCallback);
		cx.registerCallback("processCreated", handleProcessCreated);
		term.scrollToBottom();
		cxReadFunc = cx.setCustomConsole(writeData, term.cols, term.rows);
		try {
			const u = new URL(window.location.href);
			// Headless runner marker is per-tab (sessionStorage) and may also be provided via URL.
			const headlessParam = u.searchParams.get('headless');
			if (headlessParam === '1') {
				try {
					sessionStorage.setItem('webvm-headless', 'true');
				} catch (e) {}
			}
			const k = u.searchParams.get('api_key');
			if (k) {
				localStorage.setItem('webvm-api-key', k);
				u.searchParams.delete('api_key');
				history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : ''));
			}
		} catch (e) {}
			const apiKey = localStorage.getItem('webvm-api-key') || '';
		// Only run the background command executor in the headless runner.
		// If it runs in a normal interactive tab, API-triggered commands will appear in the user's xterm session.
		let isHeadlessRunner = false;
		try {
			isHeadlessRunner = sessionStorage.getItem('webvm-headless') === 'true';
		} catch (e) {}
		if (isHeadlessRunner) {
			initCommandExecutor(term, apiKey);
		}
		// Install network scripts using cx.run for reliability
		installRPCScripts();
		const display = document.getElementById("display");
		if(display)
		{
			setScreenSize(display);
			cx.setActivateConsole(handleActivateConsole);
		}
		while (true)
		{
			await cx.run(configObj.cmd, configObj.args, configObj.opts);
		}
	}
	onMount(initTerminal);
	async function handleReset()
	{
		if(blockCache == null)
			return;
		await blockCache.reset();
		location.reload();
	}
	async function handleSidebarPinChange(event)
	{
		sideBarPinned = event.detail;
		await tick();
		triggerResize();
	}
</script>

<main class="relative w-full h-full">
	<div class="absolute top-0 bottom-0 left-0 right-0">
		<SideBar {cx} on:reset={handleReset} on:sidebarPinChange={handleSidebarPinChange}>
			<slot></slot>
		</SideBar>
		{#if configObj.needsDisplay}
			<div class="absolute top-0 bottom-0 {sideBarPinned ? 'left-[23.5rem]' : 'left-14'} right-0">
				<canvas class="w-full h-full cursor-none" id="display"></canvas>
			</div>
		{/if}
		<div class="absolute top-0 bottom-0 {sideBarPinned ? 'left-[23.5rem]' : 'left-14'} right-0 p-1 scrollbar" id="console">
		</div>
	</div>
</main>
