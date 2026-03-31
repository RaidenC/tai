---
title: Security (CSP, DPoP, Zero Trust)
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Authentication-Authorization
  - SignalR-Realtime
  - Testing
---

## TL;DR

Security in modern apps requires multiple layers: CSP prevents XSS, DPoP binds tokens to keys, Zero Trust assumes no implicit trust. For interviews: understand XSS/CSRF attacks, CSP directives, token security, and the BFF pattern.

## Deep Dive

### Content Security Policy (CSP)
### DPoP (Demonstrating Proof of Possession)
### Zero Trust Architecture
### BFF Pattern

---

## Interview Q&A

### L1: What is CSP and why is it important?
**Answer:** Content Security Policy is an HTTP header that controls which resources can load. Prevents XSS by blocking inline scripts and restricting sources.

### L2: How does DPoP improve security?
**Answer:** DPoP binds access tokens to a cryptographic key pair. Even if a token is stolen, attackers can't use it without the private key.

---

*Last updated: 2026-03-30*