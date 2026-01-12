---
title: "The HSTS Mystery - When HTTPS Isn't Enough"
summary: ""
date: "Jan 0912 2026"
draft: false
tags: [Web]
---


_Missing HSTS and Cryptographic Failures (OWASP A04)_

---

## The Discovery

At first, everything looked secure.

The application was loading over HTTPS. There was an automatic redirect from HTTP to HTTPS. Nothing looked broken. But I decided to look a little closer.

I opened the Network tab and checked the response headers. That's when I noticed something **missing**.

There was no `Strict-Transport-Security` header.

The app was redirecting HTTP to HTTPS, but that's only a server-side rule. **The browser was never told to enforce HTTPS.**

That means the first request can still go over HTTP. On an untrusted network, this opens the door for HTTPS downgrade attacks.

I verified this by:

- Inspecting response headers in the Network tab
- Checking how the app behaves when accessed over `http://`

The application relied only on redirection, not browser-level enforcement. No exploit was required. The misconfiguration itself was enough to understand the risk.

**What this showed me:** Cryptographic failures are often about what's missing, not what's broken. If HSTS is not enabled, HTTPS can still be downgraded during the initial connection.

Let me explain what I learned.

---

## Understanding the Problem: HTTP by Default

Here's something that surprised me when I first learned about web security: **browsers default to HTTP, not HTTPS.**

When I type `bank.com` in my browser, here's what actually happens:

```
I type: bank.com
My browser assumes: http://bank.com  ← INSECURE by default!
```

### The Vulnerable Flow

Let me walk you through what happens without HSTS:

**Step 1:** I type "bank.com" in my browser  
**Step 2:** My browser creates a request to `http://bank.com`  
**Step 3:** My request travels over **UNENCRYPTED HTTP**  
**Step 4:** Server receives my request and sends a redirect:

```http
301 Moved Permanently
Location: https://bank.com
```

**Step 5:** My browser NOW makes an HTTPS request  
**Step 6:** Secure HTTPS connection established

Looks safe, right? Wrong.

**Steps 2-4 happen over insecure HTTP.** An attacker on my network can intercept Step 4 and prevent the redirect to HTTPS. This is called an **SSL Stripping Attack**.

---

## The Attack: SSL Stripping in Action

Let me paint you a picture. I'm sitting in a coffee shop, connected to their WiFi, trying to check my bank account.

### What Should Happen

```
[Me] --http--> [Server]
                  ↓
            "Redirect to HTTPS"
                  ↓
[Me] <--https--> [Server]    Secure
```

### What Actually Happens (The Attack)

```
[Me] --http--> [Attacker] --https--> [Server]
                   ↓
            Strips HTTPS,
            Sends HTTP to me
                   ↓
[Me] <--http--> [Attacker] <--https--> [Server]
```

The attacker positions themselves between me and the internet. When my browser sends that initial HTTP request, they intercept it. They forward it to the bank over HTTPS (so the bank thinks everything is normal), but they send the response back to me over HTTP.

### The Scary Part

Here's what I see in my browser:

```
URL bar: http://bank.com  ← No lock icon
Page: Looks completely normal
Form: Login form appears
```

I might not even notice I'm on HTTP. The page looks identical. So I enter my credentials and click "Login."

**My username and password travel in PLAINTEXT over HTTP.**

The attacker sitting in the coffee shop logs:

```
username: john@email.com
password: MyP@ssw0rd123
```

Then they forward my credentials to the bank over HTTPS. The bank sees a legitimate login. I get logged in. Everything seems fine.

But my account has just been compromised.

### Why This Works

This attack works because:

1. **I don't always check the URL scheme** - Most people don't distinguish between `http://` and `https://`
2. **Websites look identical** - The visual appearance doesn't change
3. **No browser warning** - HTTP is technically "valid," just not secure
4. **Server-side redirects can be intercepted** - Before they reach me

---

## The Solution: HSTS (HTTP Strict Transport Security)

HSTS is a simple HTTP header that solves this problem at the browser level.

### What HSTS Tells My Browser

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

This header tells my browser:

> "For the next 31,536,000 seconds (1 year), ONLY connect to this domain using HTTPS. Never use HTTP, even if someone tries to redirect you to HTTP."

### How HSTS Protects Me

#### My First Visit (Learning Phase)

```
Step 1: I type "bank.com"
Step 2: My browser sends http://bank.com
          I'M STILL VULNERABLE
Step 3: Server redirects to https://bank.com
Step 4: My browser connects via HTTPS
Step 5: Server sends HSTS header:
        Strict-Transport-Security: max-age=31536000
Step 6: My browser STORES this policy for 1 year
```

#### My Subsequent Visits (Protection Active)

```
Step 1: I type "bank.com"
Step 2: My browser checks: "Do I have an HSTS policy for bank.com?"
        → YES!
Step 3: My browser INTERNALLY upgrades to HTTPS
        (This happens BEFORE any network request)
Step 4: My browser connects DIRECTLY to https://bank.com
          NO HTTP request sent!
          NO opportunity for SSL stripping!
```

The key difference: **The upgrade happens inside my browser, where attackers can't reach it.**

---

## Breaking Down the HSTS Header

Let me explain each part of the HSTS header:

### 1. max-age (Required)

```http
Strict-Transport-Security: max-age=31536000
```

This tells my browser how long to remember the HSTS policy:

- `300` = 5 minutes (testing)
- `31536000` = 1 year (production)
- `63072000` = 2 years (maximum protection)

Every time I visit and receive the header, my browser resets the timer. If the server stops sending the header, the policy expires after the specified time.

### 2. includeSubDomains (Optional)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This applies the policy to all subdomains:

- `example.com`
- `api.example.com`
- `blog.example.com`
- `any.subdomain.example.com`

**Warning:** Only enable this if ALL subdomains support HTTPS. Otherwise, I won't be able to access HTTP-only subdomains.

### 3. preload (Optional)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

This is the ultimate protection. It allows the domain to be included in a **hardcoded list** built into browsers.

**The First Visit Problem:**

Without preload:

- First visit EVER:   I'm vulnerable
- All subsequent visits:   Protected

With preload:

- First visit EVER:   Protected (browser already knows to use HTTPS)
- All subsequent visits:   Protected

To get preloaded, I submit my domain to [hstspreload.org](https://hstspreload.org/). But be warned: **preload is nearly permanent**. Removal takes 6-12 months.

---

## HSTS vs. Server-Side Redirects: The Critical Difference

This is what I discovered on bugbait.io. Let me show you the difference:

### Server-Side Redirect (Insufficient)

```http
# I request http://example.com

# Server responds:
HTTP/1.1 301 Moved Permanently
Location: https://example.com
```

**Why this doesn't protect me:**

-   The redirect happens AFTER my HTTP request reaches the server
-   An attacker can intercept and modify the redirect
-   My browser has already sent the request over insecure HTTP

### HSTS (Browser-Level Enforcement)

```
# I previously visited and stored HSTS policy

# I type http://example.com

# My browser INTERNALLY upgrades BEFORE sending:
http://example.com → https://example.com

# First request sent is ALREADY HTTPS
```

**Why this protects me:**

-   Upgrade happens in my browser (attacker can't interfere)
-   No HTTP request ever leaves my browser
-   No opportunity for man-in-the-middle attack
-   My connection is HTTPS from the start

### Side-by-Side Comparison

|Feature|Server Redirect|HSTS|
|---|---|---|
|When it activates|After my HTTP request reaches server|Before any network request|
|Where it executes|Server-side|My browser|
|My first request|HTTP (insecure)|HTTPS (secure)|
|Vulnerable to MitM?|Yes  |No  |
|Network roundtrip needed?|Yes (slower)|No (faster)|
|Can attacker strip it?|Yes  |No  |

---

## My Testing Process on bugbait.io

Let me show you exactly how I verified this vulnerability.

### Step 1: Check the HTTPS Response Headers

I opened Chrome DevTools and navigated to the site:

```bash
# What I saw in the Network tab:
HTTP/2 200
content-type: text/html
date: Mon, 12 Jan 2026 10:00:00 GMT
# ... other headers ...

# MISSING: Strict-Transport-Security header  
```

### Step 2: Test the HTTP Redirect

I explicitly visited the HTTP version:

```bash
curl -I http://bugbait.io

# Response:
HTTP/1.1 301 Moved Permanently
Location: https://bugbait.io
```

The redirect exists. But that's not enough.

### Step 3: Observe the Vulnerable Window

In the Network tab, I watched the request sequence:

```
Request #1:
  URL: http://bugbait.io
  Status: 301 Moved Permanently
    This request is UNENCRYPTED

Request #2:
  URL: https://bugbait.io
  Status: 200 OK
    This request is encrypted
```

That first request is the vulnerability. On an untrusted network, an attacker could intercept it and prevent the HTTPS redirect.

---

## The Real-World Impact

Let me give you a concrete scenario.

### Scenario: Airport WiFi Banking

```
I'm at the airport, connected to public WiFi
I need to check my bank balance
I type "bank.com" in my browser
```

**Without HSTS:**

1. My browser sends `http://bank.com`
2. Attacker intercepts my request
3. Attacker prevents HTTPS redirect
4. I see HTTP login page (might not notice)
5. I enter my credentials
6. **Attacker captures my username and password**
7. My account is compromised

**With HSTS (after first visit):**

1. I type "bank.com"
2. My browser checks HSTS policy: "Must use HTTPS"
3. My browser connects directly to `https://bank.com`
4. Attacker cannot intercept (encrypted from start)
5. I see HTTPS login page with lock icon
6. I enter my credentials safely
7.   My credentials are protected

The difference is **automatic browser-level enforcement**.

---

## How to Implement HSTS

Let me show you how to add HSTS to different web servers.

### Apache

```apache
<VirtualHost *:443>
    ServerName example.com
    
    # Add HSTS header
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    
    # ... rest of configuration ...
</VirtualHost>
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    # Add HSTS header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # ... rest of configuration ...
}
```

### Node.js (Express)

```javascript
const helmet = require('helmet');

app.use(helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
}));
```

### Django (Python)

```python
# settings.py
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

---

## Important Limitations I Learned

### 1. The First Visit Problem

My very first visit to a site is still vulnerable because my browser hasn't learned the HSTS policy yet. This is called "Trust On First Use" (TOFU).

**Solution:** HSTS Preload List - but this requires a long-term commitment to HTTPS.

### 2. Clearing Browser Data

When I clear my browsing data, HSTS policies are deleted. My next visit is treated as a "first visit" again.

### 3. Certificate Errors Become Fatal

With HSTS, I **cannot** bypass certificate errors. This is a security feature, but it means:

- Expired certificate → Site inaccessible
- Self-signed certificate → Cannot bypass
- Name mismatch → Hard block

If the certificate has issues, I'm completely locked out until it's fixed.

### 4. Subdomain Considerations

`includeSubDomains` affects ALL subdomains. If I have a legacy subdomain that only supports HTTP, users won't be able to access it after enabling this directive.

Before enabling `includeSubDomains`, I must:

1. Audit ALL subdomains (including internal ones)
2. Ensure HTTPS works everywhere
3. Test thoroughly
4. Document any exceptions

---

## How to Check if HSTS is Enabled

Let me show you the tools I use to verify HSTS.

### Method 1: Browser DevTools

1. Open site in browser
2. Open DevTools (F12)
3. Go to Network tab
4. Reload page
5. Click on the main document request
6. Check Response Headers for: `Strict-Transport-Security`

### Method 2: Command Line

```bash
curl -I https://example.com | grep -i strict-transport-security

# Should see:
# strict-transport-security: max-age=31536000; includeSubDomains
```

### Method 3: Online Tools

- [securityheaders.com](https://securityheaders.com/)
- [observatory.mozilla.org](https://observatory.mozilla.org/)
- [hstspreload.org](https://hstspreload.org/) (for preload status)

### Method 4: Browser HSTS Cache (Chrome)

1. Navigate to: `chrome://net-internals/#hsts`
2. Enter domain in "Query HSTS/PKP domain"
3. Check if policy exists

---

**Resources:**

- [OWASP HSTS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html)
- [HSTS Preload List](https://hstspreload.org/)
- [Security Headers Scanner](https://securityheaders.com/)
- [bugbait.io - Practice Lab](https://bugbait.io/)

---

