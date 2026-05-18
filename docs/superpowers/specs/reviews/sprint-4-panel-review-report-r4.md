# Panel Review of Sprint 4 (R4): Resilience, Accessibility, and E2E Polish

**Executive summary:** 2 critical, 9 significant, 5 minor, 4 questions.

**Previous findings resolved:** R3 critical findings (scroll preservation math, banner auto-dismiss, force retry tests, focus clamp tests) have been addressed. HubConnectionState mapping table added. isRetryThrottled signal exposure clarified. Focus order within panel defined.

---

## Critical Findings

### 1. Effect Mutation Timing Race Condition [architect]
- **Severity:** CRITICAL
- **Confidence:** 9
- **Evidence:** Spec section "App Wiring for Rehydration" shows effect calling `forceRetry()` directly. Angular effects run synchronously during change detection but may batch writes. If `connectionState` signal updates during effect execution, the effect could fire multiple times before debounce logic completes. Spec says "500ms debounce" but effect-based trigger doesn't use RxJS debounce—it's a setTimeout inside effect with no cancellation guard.
- **Impact:** Rapid connection state oscillation could fire multiple forceRetry() calls before debounce completes, exhausting quota on transient flicker. Effect cleanup race: if state changes from Connected→Reconnecting→Connected within 50ms, first effect's setTimeout may still fire after debounce should have reset.
- **Recommendation:** Replace effect-based trigger with RxJS observable chain: `connectionStatus$.pipe(distinctUntilChanged(), skip(1), debounceTime(500), filter(s => s === 'Connected'))`. Subscribe in App constructor with DestroyRef cleanup. Or add explicit debounce state: `lastTriggerTime` signal checked before setTimeout, cancel pending timer on state change.

### 2. Backend Authorization Test Missing for /api/AuditLogs/recent [testing, security]
- **Severity:** CRITICAL
- **Confidence:** 10
- **Evidence:** Spec section 2.7 states "Endpoint must enforce tenant-scoped authorization server-side" and Task 14 includes "Backend authorization verification." Current test infrastructure has no test file for `/api/AuditLogs/recent` authorization. Backend test files in `apps/portal-web-backend/src/test/` show audit log tests but no cross-tenant isolation verification.
- **Impact:** Tenant isolation is a security requirement. Without automated test, regression could allow cross-tenant data exposure. Panel review rule #4: "Creates current user/security/data/operational risk before it lands."
- **Recommendation:** Add explicit test requirement in Task 14: "Create backend test verifying cross-tenant access to /api/AuditLogs/recent returns 403/404." Provide test file path: `apps/portal-web-backend/src/test/java/com/.../AuditLogsRecentAuthorizationTest.java` or equivalent Vitest test for NestJS backend.

---

## Significant Findings

### Effect and Timing

### 3. Force Retry Timestamp Storage Lacks Cleanup [architect]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says "sliding window with timestamps per tenant/user key" (Task 2). Timestamps stored in array but no cleanup when entries expire beyond 60s window. Array grows unbounded over long sessions.
- **Impact:** Memory leak for admin workstations with long browser sessions. 1000 reconnect cycles = 1000 timestamps stored.
- **Recommendation:** Add cleanup: on each forceRetry call, filter timestamps older than 60s before checking quota. Or use interval-based cleanup every 30s.

### 4. Scroll Preservation Timing Invalid with OnPush [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec's `preserveScrollDuringPrepend` uses `queueMicrotask` for scroll adjustment (line 358). Panel component uses OnPush change detection (default for standalone). Microtask runs before Angular's change detection tick. DOM measurements (`beforeScrollTop`, `list.scrollHeight`) may be stale if Angular hasn't rendered prepended items yet.
- **Impact:** Scroll adjustment calculated before items rendered = wrong height measurement. User sees visual jump.
- **Recommendation:** Use `afterNextRender` from Angular's `@angular/core` to schedule scroll adjustment after change detection completes DOM update.

### Focus and Keyboard

### 5. Mark All Read Native Disabled Focus Behavior Undefined [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Spec changed from `[attr.aria-disabled]` to native `[disabled]` (line 429). Native disabled buttons cannot receive focus via Tab. Keyboard users pressing Tab from Mark All Read when aria-disabled=true would land on next focusable; with native disabled, focus skips entirely. Different navigation behavior not documented.
- **Impact:** Focus navigation flow changes silently. Keyboard users may experience unexpected focus jumps when Mark All Read is disabled.
- **Recommendation:** Specify: "When Mark All Read is disabled (native), Tab from previous button skips to first notification item. Focus restoration after marking still targets button element (even disabled)." Or revert to aria-disabled with focus management.

### 6. Escape Behavior with Search Input Unspecified [frontend]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec says "Single Escape handler on container" closes panel (line 276). But search input field exists. Standard pattern: Escape in search input clears search, Escape again closes panel. Spec doesn't define this.
- **Impact:** User searching, presses Escape expecting clear search, panel closes unexpectedly. Or search input captures Escape, preventing panel close.
- **Recommendation:** Define: "Escape in search input clears search query. Second Escape closes panel. Escape in list items closes panel directly."

### Visual and Interaction

### 7. Filter Buttons Not Specified [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec defines focus order: search → filters → Mark All Read → items → close (R3 finding #7 resolved). But filter buttons themselves not specified: what filters exist? Severity? Category? All/Unread? Button labels, icons, toggle behavior, active state styling?
- **Impact:** Implementer must invent filter UI without guidance. Could differ from intended UX.
- **Recommendation:** Add filter button spec: "Severity filter (Critical/Warning/Info), toggle buttons, active state = filled background, inactive = outlined. Labels: severity icons + text."

### 8. No Manual Retry Action in Disconnected State [design]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** Spec shows Connected (green), Reconnecting (amber, persistent), Disconnected (red, persistent). Reconnecting has "Syncing notifications..." text. Disconnected has no manual retry option—user must wait for automatic reconnect or close panel.
- **Impact:** User sees "Disconnected" with no recourse. May wait indefinitely or close panel unaware of cached content availability.
- **Recommendation:** Add retry button in Disconnected state: "Manual retry available (uses normal retry, not force). If server unreachable, Retry shows same error state with Retry button."

### Integration

### 9. isRetryThrottled Signal Not Yet Exposed [integration]
- **Severity:** SIGNIFICANT
- **Confidence:** 8
- **Evidence:** R3 finding #11 identified gap. Spec now clarifies Task 2 must expose `isRetryThrottled` signal. But current NotificationHistoryService code review shows no such signal. Signal is listed as required but implementation blocked on Task 2.
- **Impact:** Tasks 8-10 depend on Task 2 completing first. Task ordering dependency not explicit in implementation order.
- **Recommendation:** Add dependency annotation: "Task 2 must complete before Tasks 8, 9, 10 can use isRetryThrottled signal."

### Security

### 10. CI Grep Check Not Yet Implemented [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 9
- **Evidence:** Spec requires `grep -r "__testConnectionStateOverride__" dist/portal-web/` must return 0 matches in production build. Task 14 says "verify test hook excluded." CI pipeline not yet updated with this check.
- **Impact:** Without CI enforcement, test hook could leak to production through configuration error or later refactoring.
- **Recommendation:** Add CI step: GitHub Actions workflow or Nx pre-build hook runs grep verification. Block build if matches found.

### 11. Server-Side Rate Limiting Deferred Without Risk Note [security]
- **Severity:** SIGNIFICANT
- **Confidence:** 7
- **Evidence:** Client-side forceRetry limit (10/60s) is defense-in-depth. Spec defers server-side rate limiting. Dependency Contract table should note: "current client-side limit is POC-only, production requires server-side rate limit."
- **Impact:** Admin workstation assumption may not hold for production deployment. Malicious actor could bypass client limit.
- **Recommendation:** Update Dependency Contract: add row for "Server-side rate limiting on /api/AuditLogs/recent" with obligation "Client-side limit documented as POC-only, not production-ready."

---

## Minor Findings

- **Effect cleanup timing**: spec should clarify DestroyRef cleanup runs on App destroy, not effect cleanup
- **Search query reapplication**: clarified as "persist and reapply" in R3, but no test for query matching nothing after hydrate
- **Banner layering**: multiple simultaneous indicators (banner + syncing + search helper) noted in R3, spec partially addresses but search helper still appears during reconnecting
- **Test hook validation**: add runtime validation for valid HubConnectionState values
- **Empty state copy**: "No notifications" vs "No results for '[query]'" differentiation complete, but minor copy polish for "No results"

---

## Questions For Human

1. **Effect timing:** Should rehydration trigger use RxJS observable chain instead of effect-based setTimeout for robust debounce behavior?
2. **Backend authorization test:** Is cross-tenant isolation test already implemented elsewhere, or must it be created for this sprint?
3. **Mark All Read focus:** Should native `[disabled]` be used (focus skipped) or `[attr.aria-disabled]` (focusable, announces disabled)?
4. **Filter buttons:** What filters should exist—severity only, severity + category, or severity + read/unread?

---

## Conflicts

### Mark All Read Disabled State
- **Frontend reviewer:** Native disabled changes Tab navigation flow (focus skips disabled button)
- **Spec:** Uses native `[disabled]` without acknowledging focus behavior change
- **Resolution needed:** Either document new Tab flow, or revert to aria-disabled for consistent focus navigation

---

## Recommended Decision

**REVISE_PLAN**

The two critical findings require resolution before implementation:

1. **Effect mutation timing race condition**: Effect-based rehydration trigger with setTimeout lacks proper debounce cancellation. Rapid state flicker could exhaust quota. Should use RxJS debounce operator or add explicit cancellation guard.

2. **Backend authorization test missing**: Tenant isolation for `/api/AuditLogs/recent` is a stated security requirement but has no automated verification. This creates security risk per panel review rule #4.

Additionally, 4 significant findings around OnPush timing, native disabled focus behavior, filter button specification, and CI grep enforcement should be clarified.

**Required revisions:**

1. Replace effect-based rehydration trigger with RxJS observable chain with debounceTime(500), or add explicit timer cancellation guard
2. Add backend authorization test requirement with file path and test structure
3. Add `afterNextRender` for scroll preservation timing with OnPush
4. Define Mark All Read focus behavior with native disabled (or revert to aria-disabled)
5. Specify filter buttons (severity, labels, active state)
6. Add CI grep verification step for test hook exclusion
7. Update Dependency Contract with server-side rate limiting risk note

---

## Prior Findings Verified as Resolved

The following R3 findings were correctly addressed:

- **Scroll preservation math**: Adjusts scrollTop by prepended height (line 365)
- **Banner auto-dismiss**: Connected banner now persistent, no timer (line 176)
- **Force retry upper bound test**: Added test requirement (line 528)
- **Focus clamp mutation test**: Added test requirement (line 531)
- **HubConnectionState mapping**: Explicit table with rationale (lines 109-116)
- **isRetryThrottled signal**: Task 2 clarifies exposure (line 124)
- **Focus order**: Explicit order defined (line 269)

R2 findings verified as resolved:

- **Force retry quota UX**: Recovery notice added (lines 190-195)
- **Toggle indicator**: 10px dot, color, placement, aria-label templates (lines 221-234)
- **Environment directory**: Task 1 explicitly states create directory (line 91)

R1 findings verified as resolved:

- **Build infrastructure**: Angular environment file replacements, no webpack (Task 1)
- **CI verification**: grep command specified (line 542)