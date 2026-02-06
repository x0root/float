<h1 class="text-lg font-bold">Information</h1>
<img src="assets/webvm_hero.png" alt="Float Logo" class="w-56 h-56 object-contain self-center">
<p class="text-sm leading-relaxed mt-2">
  Float is an open-source, client-side containerization platform that runs full Linux environments directly in the browser through WebAssembly. Built on CheerpX's x86 emulation and JIT engine, it enables developers to spin up multiple isolated Debian containers from a single disk image—all running entirely on the client side without backend infrastructure.
</p>
<p class="text-sm leading-relaxed mt-2">
  With its container management API and Docker-inspired orchestration, Float lets developers programmatically control, connect to, and manage containers through a familiar interface, while offloading compute costs from servers to users' browsers. The platform is deployable on any static host like Vercel or localhost, with networking that leverages the host environment for internet access, making it a zero-backend solution for running Linux containers at scale.
</p>
<p class="mt-2">It is based on:</p>
<ul class="list-disc list-inside text-sm">
	<li><a class="underline" target="_blank" href="https://cheerpx.io/">CheerpX</a>: x86 JIT in Wasm</li>
	<li><a class="underline" target="_blank" href="https://xtermjs.org/">Xterm.js</a>: interactive terminal</li>
	<li>Local/private <a class="underline" target="_blank" href="https://cheerpx.io/docs/guides/File-System-support">file storage</a></li>
	<li>HTTP Gateway for internet access via host proxy</li>
</ul>
<slot></slot>
