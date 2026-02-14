// Unified network gateway script - single file for basic network operations
// Usage: net curl <url>  OR  net wget <url>

export const NET_GATEWAY_SCRIPT = `#!/usr/bin/env python3
import sys
import base64
from urllib.parse import urlparse


def normalize_url(url):
    # Accept short forms like "google.com" by defaulting to HTTPS.
    parsed = urlparse(url)
    if parsed.scheme:
        return url
    return "https://" + url


def _read_until_endresponse():
    response = ""
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        if "__ENDRESPONSE__" in line:
            response += line.split("__ENDRESPONSE__")[0]
            break
        response += line
    return response


def _is_fetch_error(resp):
    text = (resp or "").strip().lower()
    return (
        text.startswith("fetch failed")
        or text.startswith("error:")
        or text.startswith("unauthorized")
        or text.startswith("server configuration error")
    )


def _with_http_fallback(url, fetch_fn):
    # Try requested URL first. If it fails and is HTTPS, retry HTTP.
    # This helps environments where TLS fetch path is blocked but HTTP works.
    primary = fetch_fn(url)
    if _is_fetch_error(primary) and url.startswith("https://"):
        fallback = fetch_fn("http://" + url[len("https://"):])
        if not _is_fetch_error(fallback):
            return fallback
    return primary


def gateway_fetch_text(url):
    def _fetch(u):
        print("__FETCH__" + u + "__ENDFETCH__", flush=True)
        return _read_until_endresponse()

    return _with_http_fallback(url, _fetch)


def gateway_fetch_head(url):
    # Ask the host to perform a HEAD request and return headers as text.
    def _fetch(u):
        print("__FETCH_HEAD__" + u + "__ENDFETCH_HEAD__", flush=True)
        return _read_until_endresponse()

    return _with_http_fallback(url, _fetch)


def gateway_fetch_b64(url):
    # Requests binary content from the host gateway, returned as base64.
    def _fetch(u):
        print("__FETCH_B64__" + u + "__ENDFETCH_B64__", flush=True)
        return _read_until_endresponse().strip()

    b64 = _with_http_fallback(url, _fetch)

    # If the gateway returned an explicit error message, raise.
    if _is_fetch_error(b64):
        raise RuntimeError(b64.strip() or "fetch failed")

    if not b64:
        raise RuntimeError("Empty response")

    try:
        return base64.b64decode(b64)
    except Exception as e:
        raise RuntimeError(f"Failed to decode base64: {e}")


def infer_download_filename(url):
    tail = url.rstrip('/').split('/')[-1]
    return tail or 'download'


def do_curl(args):
    url = None
    output = None
    output_remote_name = False
    head_only = False
    i = 0
    while i < len(args):
        if args[i] in ("-o", "--output") and i + 1 < len(args):
            output = args[i + 1]
            i += 2
        elif args[i] in ("-O", "--remote-name"):
            output_remote_name = True
            i += 1
        elif args[i] in ("-I", "--head"):
            head_only = True
            i += 1
        elif args[i] in ("-L", "--location", "-s", "--silent"):
            i += 1
        elif not args[i].startswith("-"):
            url = args[i]
            i += 1
        else:
            i += 1

    if not url:
        print("Usage: curl [-I] [-o output|-O] <url>", file=sys.stderr)
        return 1

    url = normalize_url(url)

    if head_only:
        content = gateway_fetch_head(url)
        print(content)
        return 0

    target = output
    if output_remote_name:
        target = infer_download_filename(url)

    if target:
        content = gateway_fetch_b64(url)
        with open(target, 'wb') as f:
            f.write(content)
        if not output_remote_name:
            print(f"Saved to {target}")
        return 0

    content = gateway_fetch_text(url)
    print(content)
    return 0


def do_wget(args):
    url = None
    output = None
    i = 0
    while i < len(args):
        if args[i] in ("-O", "--output-document") and i + 1 < len(args):
            output = args[i + 1]
            i += 2
        elif args[i].startswith("-"):
            i += 1
        else:
            url = args[i]
            i += 1

    if not url:
        print("Usage: wget [-O output] <url>", file=sys.stderr)
        return 1

    url = normalize_url(url)
    filename = output or infer_download_filename(url)
    content = gateway_fetch_b64(url)
    with open(filename, 'wb') as f:
        f.write(content)
    print(f"Saved to {filename}")
    return 0


def main():
    if len(sys.argv) < 2:
        print("Float Network Gateway", file=sys.stderr)
        print("Usage: net curl [-I] [-o output|-O] <url>", file=sys.stderr)
        print("       net wget [-O output] <url>", file=sys.stderr)
        return 1

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd == "curl":
        return do_curl(args)
    elif cmd == "wget":
        return do_wget(args)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
`;
