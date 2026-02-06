// Minimal RPC script - no base64, no complex escaping
// Just print markers and wait for response

export const WVM_CLIENT_SCRIPT = `#!/usr/bin/env python3
import sys

if len(sys.argv) < 2:
    print("Usage: curl <url>")
    sys.exit(1)

url = sys.argv[1]

# Print request marker
print("__FETCH__" + url + "__ENDFETCH__")
sys.stdout.flush()

# Read until we see response end marker
response = ""
while True:
    line = sys.stdin.readline()
    if "__ENDRESPONSE__" in line:
        # Extract content before marker
        response += line.split("__ENDRESPONSE__")[0]
        break
    response += line

# Print just the data part
print(response)
`;
