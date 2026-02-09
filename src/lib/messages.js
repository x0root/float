const color = "\x1b[1;35m";
const underline = "\x1b[94;4m";
const normal = "\x1b[0m";

const BOX_INNER_WIDTH = 77;
const BOX_TEXT_WIDTH = BOX_INNER_WIDTH - 2;
const BOX_BORDER = "+" + "~".repeat(BOX_INNER_WIDTH) + "+";
function boxLine(text = "") {
  return "| " + String(text).padEnd(BOX_TEXT_WIDTH, " ") + " |";
}
export const introMessage = [
  BOX_BORDER,
  boxLine(),
  boxLine("Welcome to Float!"),
  boxLine(),
  boxLine("Float is powered by the CheerpX virtualization engine, which enables safe,"),
  boxLine("sandboxed execution of x86 binaries, fully client-side."),
  boxLine(),
  boxLine("CheerpX includes an x86-to-WebAssembly JIT compiler, a virtual block-based"),
  boxLine("file system, and a Linux syscall emulator."),
  boxLine(),
  BOX_BORDER,
  "",
  "   If unsure, try these examples:",
  "",
  "     python3 examples/python3/fibonacci.py ",
  "     gcc -o helloworld examples/c/helloworld.c && ./helloworld",
  "     objdump -d ./helloworld | less -M",
  "     vim examples/c/helloworld.c",
  "     curl --max-time 15 parrot.live  # requires networking",
  "",
];
export const errorMessage = [
  color + "CheerpX could not start" + normal,
  "",
  "Check the DevTools console for more information",
  "",
  "CheerpX is expected to work with recent desktop versions of Chrome, Edge, Firefox and Safari",
  "",
  "Give it a try from a desktop version / another browser!",
  "",
  "CheerpX internal error message is:",
  "",
];
export const unexpectedErrorMessage = [
  color + "WebVM encountered an unexpected error" + normal,
  "",
  "Check the DevTools console for further information",
  "",
  "Please consider reporting a bug!",
  "",
  "CheerpX internal error message is:",
  "",
];
