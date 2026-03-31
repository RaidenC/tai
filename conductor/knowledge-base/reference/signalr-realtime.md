---
title: SignalR & Real-Time
difficulty: L1-L3
lastUpdated: 2026-03-30
relatedTopics:
  - Authentication-Authorization
  - RxJS-Signals
  - Security-CSP-DPoP
---

## TL;DR

SignalR enables real-time bidirectional communication between server and clients. Uses WebSockets with fallback to Server-Sent Events or Long Polling. For interviews: understand hub vs connection, groups, authentication, and handling reconnection.

## Deep Dive

### Hubs & Connections
### Groups & Users
### Authentication
### Reconnection

---

## Interview Q&A

### L1: What is a SignalR Hub?
**Answer:** A hub is a high-level pipeline that allows clients and servers to call methods on each other. It handles serialization and routing.

### L2: How do you handle reconnection in SignalR?
**Answer:** SignalR has built-in automatic reconnection. You can handle events like onreconnecting, onreconnected, onclose to customize behavior.

---

*Last updated: 2026-03-30*