#!/bin/bash

# TAI Portal - CSP Audit Script
# 
# JUNIOR RATIONALE: This script is our "Security Scanner." It acts like 
# a robot that visits our website and checks the "Headers" (metadata) 
# sent by the server. We're looking for a header called 'Content-Security-Policy'.
# This header is like a "No-Fly Zone" for hackers—it tells the browser 
# exactly which scripts and styles are allowed to run.

# 1. Setup the target URL (Defaults to our local Identity Diagnostic endpoint)
TARGET_URL=${1:-"http://localhost:5217/identity/diag/headers"}
echo "[CSP-AUDIT] Scanning: $TARGET_URL"

# 2. Fetch the headers using 'curl'
# -s: Silent mode (don't show progress)
# -I: Head only (we only care about the metadata, not the page content)
# -H: Add our Gateway Secret so the server lets us in.
SECRET=${GATEWAY_SECRET:-"portal-poc-secret-2026"}
HEADERS=$(curl -s -I -H "X-Gateway-Secret: $SECRET" "$TARGET_URL")

# 3. Look for the CSP header in the response
# 'grep -i' searches for the text while ignoring case.
CSP=$(echo "$HEADERS" | grep -i "Content-Security-Policy")

# 4. Check if the header exists at all
if [ -z "$CSP" ]; then
    echo "❌ [ERROR] Content-Security-Policy header is MISSING!"
    echo "RATIONALE: Without this header, we are vulnerable to XSS attacks."
    exit 1
fi

echo "[CSP-AUDIT] Found CSP: $CSP"

# 5. Check for dangerous "unsafe" keywords
# JUNIOR RATIONALE: We have a "Zero-Violation" policy. 
# 'unsafe-inline' and 'unsafe-eval' are like leaving the back door unlocked.
# Hackers use these to inject malicious code into our pages.

if echo "$CSP" | grep -q "unsafe-inline"; then
    echo "❌ [ERROR] CSP contains 'unsafe-inline' which is FORBIDDEN!"
    echo "RATIONALE: Use Nonces or external files instead of inline <script> tags."
    exit 1
fi

if echo "$CSP" | grep -q "unsafe-eval"; then
    echo "❌ [ERROR] CSP contains 'unsafe-eval' which is FORBIDDEN!"
    echo "RATIONALE: eval() is dangerous and prevents the browser from optimizing code."
    exit 1
fi

# 6. Success!
echo "✅ [SUCCESS] CSP Audit Passed: No unsafe-inline or unsafe-eval detected."
exit 0
