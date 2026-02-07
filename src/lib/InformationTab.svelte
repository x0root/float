<h1 class="text-lg font-bold">Information</h1>
<p class="text-sm leading-relaxed mt-2">
  Float is an open-source, client-side containerization platform that runs full Linux environments directly in the browser through WebAssembly. Built on CheerpX's x86 emulation and JIT engine, it enables developers to spin up multiple isolated Debian containers from a single disk image—all running entirely on the client side without backend infrastructure.
</p>
<p class="mt-2">It is based on:</p>
<ul class="list-disc list-inside text-sm">
	<li><a class="underline" target="_blank" href="https://cheerpx.io/">CheerpX</a>: x86 JIT in Wasm</li>
	<li><a class="underline" target="_blank" href="https://xtermjs.org/">Xterm.js</a>: interactive terminal</li>
	<li>Local/private <a class="underline" target="_blank" href="https://cheerpx.io/docs/guides/File-System-support">file storage</a></li>
	<li>HTTP Gateway for internet access via host proxy</li>
</ul>
<slot></slot>
