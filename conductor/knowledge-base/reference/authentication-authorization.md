---
title: Authentication & Authorization
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Security-CSP-DPoP
  - EFCore-SQL
  - Angular-Core
---

## TL;DR

Authentication verifies WHO a user is (login). Authorization verifies WHAT they can do (permissions). In fintech: use OIDC/OAuth2 for authentication, DPoP for token binding, and role/claim-based authorization. For interviews: understand OAuth2 flows, JWT structure, and token security.

## Deep Dive

### OIDC & OAuth2
### JWT & Tokens
### DPoP (Proof of Possession)
### Role-Based Access

---

## Interview Q&A

### L1: What is the difference between authentication and authorization?
**Answer:** Authentication = "who are you?" (login). Authorization = "what can you do?" (permissions).

### L2: Explain the OAuth2 authorization code flow
**Answer:** User redirects to auth server, receives authorization code, client exchanges code for tokens. More secure than implicit flow.

---

*Last updated: 2026-03-30*