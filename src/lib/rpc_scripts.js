// Minimal RPC script - no base64, no complex escaping
// Just print markers and wait for response

export const WVM_CLIENT_SCRIPT = `#!/usr/bin/env python3
import sys
import os

def simple_fetch(url):
    """Simple fetch for basic URL requests"""
    print("__FETCH__" + url + "__ENDFETCH__")
    sys.stdout.flush()
    
    # Read until we see response end marker
    response = ""
    while True:
        line = sys.stdin.readline()
        if "__ENDRESPONSE__" in line:
            response += line.split("__ENDRESPONSE__")[0]
            break
        response += line
    return response

def parse_curl_args(argv):
    """Parse curl command line arguments"""
    url = None
    output_file = None
    method = "GET"
    headers = {}
    data = None
    
    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg in ("-o", "--output") and i + 1 < len(argv):
            output_file = argv[i + 1]
            i += 2
        elif arg in ("-X", "--request") and i + 1 < len(argv):
            method = argv[i + 1]
            i += 2
        elif arg in ("-H", "--header") and i + 1 < len(argv):
            header = argv[i + 1]
            if ":" in header:
                key, value = header.split(":", 1)
                headers[key.strip()] = value.strip()
            i += 2
        elif arg in ("-d", "--data") and i + 1 < len(argv):
            data = argv[i + 1]
            i += 2
        elif arg in ("-L", "--location"):
            i += 1
        elif arg in ("-s", "--silent", "-S", "--show-error"):
            i += 1
        elif not arg.startswith("-"):
            url = arg
            i += 1
        else:
            i += 1
    
    return url, output_file, method, headers, data

def parse_wget_args(argv):
    """Parse wget command line arguments"""
    url = None
    output_file = None
    
    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg in ("-O", "--output-document") and i + 1 < len(argv):
            output_file = argv[i + 1]
            i += 2
        elif arg.startswith("--"):
            i += 1
        elif arg.startswith("-"):
            i += 1
        else:
            url = arg
            i += 1
    
    return url, output_file

def main():
    if len(sys.argv) < 2:
        print("Usage: wvm_client.py <url> or as curl/wget wrapper")
        sys.exit(1)
    
    prog_name = os.path.basename(sys.argv[0])
    url = None
    output_file = None
    
    if prog_name == "curl" or sys.argv[0].endswith("curl"):
        url, output_file, method, headers, data = parse_curl_args(sys.argv)
    elif prog_name == "wget" or sys.argv[0].endswith("wget"):
        url, output_file = parse_wget_args(sys.argv)
    else:
        url = sys.argv[1]
    
    if not url:
        print("Error: No URL specified", file=sys.stderr)
        sys.exit(1)
    
    content = simple_fetch(url)
    
    if output_file:
        try:
            with open(output_file, 'w') as f:
                f.write(content)
            print(f"Saved to {output_file}")
        except Exception as e:
            print(f"Error writing file: {e}", file=sys.stderr)
            print(content)
    else:
        print(content)

if __name__ == "__main__":
    main()
`;
