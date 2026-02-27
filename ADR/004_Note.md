# Day 4 Summary: The API Security Gateway

## 1. Executive Summary
On Day 4, we transitioned from building the application's core logic to hardening its "front door." We implemented a critical piece of infrastructure: a secure **API Gateway**. This acts as a sentry for our entire system, enforcing security policies before any request can reach our backend services. We implemented three key security features:

1.  **YARP API Gateway:** A centralized entry point for all API traffic.
2.  **Rate Limiting:** Protection against brute-force attacks.
3.  **DPoP (Demonstrating Proof-of-Possession):** A cutting-edge defense against access token theft.

These features move our architecture towards a "Zero Trust" model, where security is layered and not just dependent on a single firewall.

## 2. Key Technical Features (The "What" and "Why")

### Feature 4.1: YARP API Gateway

*   **What it is:** YARP (Yet Another Reverse Proxy) is a gateway built by Microsoft that sits in front of our backend services. All incoming requests from the internet first hit the gateway, which then intelligently forwards them to the correct internal service (like our Identity API).

*   **Why we used it:** In a microservices architecture, you might have dozens of small services. The gateway provides a single, stable address for the outside world, simplifying management and security. Its key roles are:
    1.  **Single Point of Entry:** Frontend applications only need to know about one URL (`api.portal.com`), not the addresses of dozens of backend services.
    2.  **SSL Termination:** The gateway handles all the complex and CPU-intensive work of HTTPS encryption/decryption. Our internal services can communicate over simpler HTTP, which is easier to manage inside our secure network.
    3.  **Centralized Cross-Cutting Concerns:** Instead of adding logging, authentication, and rate-limiting code to every single microservice, we can implement it once in the gateway.

*   **Implementation Highlights:**
    *   We created a new ASP.NET Core project (`apps/portal-gateway`).
    *   Configuration is managed in `appsettings.json`, where we define `Routes` (how to match an incoming request, e.g., `/identity/...`) and `Clusters` (where to send it, e.g., `http://localhost:5001`).
    *   We configured the `X-Forwarded` transform. This is crucial because when the gateway forwards a request, the backend service loses the original client's IP address. This transform adds headers like `X-Forwarded-For` so the backend service knows who the original user was, which is vital for logging and security.

### Feature 4.2: Rate Limiting Middleware

*   **What it is:** A mechanism to control how many requests a user can make in a given time period. We implemented the **"Token Bucket"** algorithm:
    *   Imagine every user (identified by their IP address) has a bucket that holds 10 tokens.
    *   To make an API request, you must "spend" one token.
    *   The bucket is refilled with 10 new tokens every minute.
    *   If you run out of tokens, your requests are rejected with an `HTTP 429 Too Many Requests` error until the bucket is refilled.

*   **Why we used it:** To protect our most sensitive endpoint, `/connect/token`, from **brute-force attacks**. Without rate limiting, an attacker could try to guess passwords thousands of times per second, potentially locking out user accounts or overwhelming the server.

*   **Implementation Highlights:**
    *   We used .NET 10's built-in `System.Threading.RateLimiting` library.
    *   In `Program.cs`, we defined a policy named `"token-bucket"` partitioned by the caller's IP address.
    *   In YARP's configuration (`appsettings.json`), we applied this policy specifically to the route that handles `/connect/token`.

### Feature 4.3: DPoP (Demonstrating Proof-of-Possession)

*   **What it is:** The ultimate defense against token theft. Standard "Bearer" access tokens are like cash: whoever holds (bears) the token can use it. If an attacker steals a Bearer token from a user's browser, they can impersonate that user completely.

    **DPoP makes tokens work like a check instead of cash.** A DPoP-bound token is tied to a specific client's private key. To use the token, the client must also provide a "proof" signed with that private key for every single API request.

*   **Why we used it:** It makes stolen access tokens useless. Even if an attacker manages to steal an access token through an XSS attack or by finding it in log files, they cannot use it because they do not have the user's unique, session-specific private key needed to generate the required DPoP proof. This aligns with the highest security standards, like FAPI 2.0.

*   **Implementation Highlights:**
    1.  **Frontend (Angular):** We created an `HttpInterceptor`. Before an API request is sent, this interceptor:
        *   Generates a temporary public/private key pair using the browser's native `Web Crypto API`. The private key is non-extractable, meaning JavaScript code can't read it.
        *   Creates a small JWT (the DPoP proof) containing the HTTP method and URL.
        *   Signs the proof with the private key.
        *   Attaches this signed proof to the request in a `DPoP` header.
    2.  **Backend (.NET):** The OpenIddict server is configured to recognize these DPoP headers. When it issues a token to a client that provided a DPoP proof, it "binds" the token to that client's public key. The validation middleware then ensures every subsequent request using that token includes a valid proof signed by the corresponding private key.

## 3. Interview Talking Points

### On API Gateways
**Q: "What is the role of an API Gateway, and why would you use one?"**
> **A:** "An API Gateway acts as a single entry point or 'front door' for a microservices architecture. We used YARP for this. It gives us three main benefits: 1) It simplifies the client by providing a single URL instead of many service addresses. 2) It centralizes cross-cutting concerns like SSL termination, logging, and security, so we don't have to duplicate that code in every service. 3) It improves security by hiding our internal network topology and providing a single place to enforce policies like rate limiting."

**Q: "When a request goes through a gateway, what happens to the client's IP address?"**
> **A:** "By default, the backend service would see the gateway's IP address. This is a problem for logging and security. To solve this, the gateway adds the `X-Forwarded-For` header, which contains the original client IP. Our backend services are configured to trust this header from the gateway, so they can correctly identify the end-user."

### On Rate Limiting
**Q: "How would you protect a login API from a brute-force attack?"**
> **A:** "We'd implement rate limiting. In our project, we used .NET's built-in `RateLimiting` middleware to apply a Token Bucket policy to the `/connect/token` endpoint. We configured it to allow 10 requests per minute per IP address. Any further requests from that same IP within the minute are immediately rejected with an HTTP 429 status, preventing the attacker from overwhelming the system."

### On DPoP and Token Security
**Q: "Bearer tokens are the standard in OAuth 2.0, but what is their main security weakness?"**
> **A:** "Their main weakness is that they are 'bearer' tokens. Like cash, whoever possesses the token can use it. If an attacker steals one from a user's browser storage via an XSS attack, they can gain full access to that user's account until the token expires. There's nothing in the token itself that ties it to the legitimate user's device."

**Q: "How does DPoP solve that problem?"**
> **A:** "DPoP, or Demonstrating Proof-of-Possession, upgrades bearer tokens to be more like a check than cash. It cryptographically binds an access token to a specific client instance. For every single API call, the client must generate a unique 'proof'—a signed JWT—that proves it possesses the private key associated with the token. If an attacker steals the token, it's useless because they can't generate the required proofs. We implemented this in our Angular app using an `HttpInterceptor` and the browser's native Web Crypto API, which is a modern, highly secure approach."
