# Day 1 Summary: The Foundation

## 1. Executive Summary
On Day 1, we established the "Skeleton" of the TAI Portal system. Instead of a standard file-new-project, we built a **Polyglot Monorepo** capable of hosting high-performance .NET 10 services alongside a modern Angular 21 frontend. The focus was on **Strictness** (Architecture) and **Compatibility** (Standard JIT/Zone.js).

## 2. Key Technical Decisions (The "Why")

### A. Nx Monorepo (The Container)
*   **What:** A build system that manages both C# and TypeScript in one graph.
*   **Why:** It allows us to share contracts (DTOs) and enforce architectural boundaries via linting rules. If I change the Backend API, Nx knows exactly which Frontend tests to run.

### B. Angular 21 (The Frontend)
*   **What:** We use standard Angular with `zone.js`.
*   **Why:** Ensures maximum compatibility with third-party libraries and development tools while still leveraging modern Signal-based state management.

### C. .NET 10 (The Backend)
*   **What:** Using the standard .NET 10 Runtime (JIT).
*   **Why:**
    1.  **Compatibility:** Full support for all .NET libraries and tools.
    2.  **Build Speed:** Fast compilation for rapid development iteration.