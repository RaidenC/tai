# Panel Review of Sprint 4 Implementation Plan (R1)

**Executive summary:** 5 critical, 17 significant, 15 minor, 4 questions.

**Review round:** R1 — first review of the implementation plan. Broad findings allowed.

---

## Critical Findings

### 1. E2E Test Hook Argument Type Mismatch [architect]
- **Confidence:** 9
- **Evidence:** Task 8 E2E tests pass string literals like `'Disconnected'` and `'Connected'` to `window.__testConnectionStateOverride__()`. Task 3 Step 3 defines the hook with validation `if (!Object.values(HubConnectionState).includes(state)) { return; }`. `HubConnectionState` is a numeric enum (Connected=1, Disconnected=4), not string literals.
- **Impact:** E2E tests will fail silently — the hook rejects string inputs and returns early. Connection state won't actually transition, making resilience tests invalid.
- **Recommendation:** Change E2E tests to use numeric enum values (e.g., `window.__testConnectionStateOverride__(4)` for Disconnected) or modify the hook to accept string input and map internally.

### 2. Backend Test Fixture Class Does Not Exist [security]
- **Confidence:** 10
- **Evidence:** Task 4 references `PortalApiFactory` class: `public class AuditLogsRecentAuthorizationTests : IClassFixture<PortalApiFactory>`. No such class exists in the repo. Existing tests use `WebApplicationFactory<Program>`.
- **Impact:** Task 4 test file cannot be implemented as written. Blocker for backend authorization tests.
- **Recommendation:** Either create `PortalApiFactory` before Task 4, or change fixture to `WebApplicationFactory<Program>` and adapt `CreateAdminClient` to match existing patterns (TestAuthHandler, TestUserContext).

### 3. Test Authentication Headers Not Recognized by Backend [security]
- **Confidence:** 9
- **Evidence:** Task 4's `CreateAdminClient` adds headers `X-Test-User-Id` and `X-Test-Roles`. These headers are not recognized anywhere in the backend. Existing auth pattern uses `TestAuthHandler` with `TestUserContext` singleton (see `TestHelpers.cs`).
- **Impact:** Tests will fail at authentication — backend will return 401/403, not 200 OK.
- **Recommendation:** Adapt `CreateAdminClient` to use existing `TestAuthHandler` pattern with `TestUserContext`, matching `PrivilegeSecurityTests.CreateFactoryWithMockAuth`.

### 4. Roving Tabindex Prevents Tab Navigation into Notification Items [frontend]
- **Confidence:** 9
- **Evidence:** Task 6 Step 5 sets `[attr.tabindex]="focusedNotificationIdForTest() === notification.id ? 0 : -1"` for all items. Initial `focusedNotificationId = null`, meaning ALL items start with `tabindex="-1"` and are not Tab-focusable. WAI-ARIA roving tabindex requires at least one item be Tab-focusable.
- **Impact:** Keyboard users cannot Tab into notification items at all. Arrow keys only fire when focus is on the scroll region, creating a dead-end for Tab navigation. Violates spec's stated Tab order.
- **Recommendation:** Make the first visible item always have `tabindex="0"` so Tab from Mark All Read lands on an item. Implement proper roving tabindex pattern where the "current" item (first by default) is focusable.

### 5. Build Output Path Mismatch in Production Grep Check [operations]
- **Confidence:** 10
- **Evidence:** Task 9 Step 1: `if rg "__testConnectionStateOverride__" dist/apps/portal-web; then`. Actual build output is at `dist/apps/portal-web/browser/` (verified via existing `serve-static` config). The grep searches parent directory but bundled JS is in browser subdirectory.
- **Impact:** Production build with leaked hook would pass the CI check because ripgrep won't find the string in the non-bundle directory level. Silent verification failure.
- **Recommendation:** Change all grep commands to: `rg -r "__testConnectionStateOverride__" dist/apps/portal-web` or target `dist/apps/portal-web/browser`.

---

## Significant Findings

### Connection State/Retry Throttling (architect, frontend, testing)
- **Connection override may trigger real rehydration:** Test hook setting `Connected` could emit through `observedConnectionState$` and trigger actual API calls. Clarify acceptable behavior or add guard. (architect, confidence 8)
- **Parallel retry tracking systems unexplained:** Two throttling mechanisms (user retry vs force retry) with different limits and UI signals. Add architecture note explaining intent and expected behavior when one is throttled but other isn't. (architect, confidence 7)
- **Error state Retry uses native disabled:** Plan uses `[disabled]` but spec requires `aria-disabled` to keep button focusable for keyboard users. (frontend, confidence 9)
- **Missing forceRetry auth boundary tests:** Task 2 tests throttle limits but not null user/tenantId/hydrating guards. (testing, confidence 9)
- **Missing retry throttle E2E test:** No end-to-end test for retry throttle UX flow. (testing, confidence 7)

### Focus Management (frontend, testing)
- **Escape handler double-close conflict:** Container has `(keydown.escape)="close()"` and `onSearchKeydown` also calls `close()` without stopping propagation. (frontend, confidence 8)
- **Mark All Read focus destination missing:** Button becomes disabled but no focus movement handler specified. (frontend, confidence 9)
- **Missing focus trap behavioral test:** No test verifies Tab key actually traps focus within panel. (testing, confidence 8)

### Backend Integration Tests (security, testing)
- **Host header mechanism differs from existing pattern:** Plan sends Host as request header; existing tests use `WebApplicationFactoryClientOptions.BaseAddress`. May not propagate correctly through TestServer. (security, confidence 8)
- **Missing backend negative tests:** No tests for unauthenticated request, invalid limit parameter, malformed query string. (testing, confidence 8)

### Template/Config Integration (integration, operations)
- **app.html modifications split across Task 3 and Task 7:** Neither shows combined final template. Implementer may miss bindings. (integration, confidence 9)
- **project.json modifications need merge guidance:** Snippets add to existing configurations but don't show complete merged JSON. (integration, confidence 8)
- **Constructor/ngOnInit timing unclear:** Task 3 adds constructor with test hook and reconnect stream but doesn't explain relationship to ngOnInit auth flow. (integration, confidence 7)

### E2E Infrastructure (integration, operations)
- **E2E auth session file not verified:** Tests reference `acme-session.json` but existence not confirmed. Default is `session.json`. (integration, confidence 8)
- **E2E serve configuration mismatch:** CI workflow defaults to `development` serve, but E2E tests require test configuration with hook enabled. Plan doesn't modify e2e serve command. (operations, confidence 9)

### Responsive/Visual (frontend)
- **Responsive behavior not implemented:** No mobile breakpoints or touch target adjustments per spec Section 4. (frontend, confidence 10)
- **Skeleton timing not implemented:** No 300ms delay/min-display logic per spec. (frontend, confidence 10)
- **Empty state sub-caption missing:** Spec requires "Privilege, approval, and security events will appear here." (frontend, confidence 10)
- **Connection banner icons missing:** Spec requires icons (check, spinner, X) but plan shows only text. (frontend, confidence 10)

### Operations (operations)
- **Rollback path not documented:** No steps if build gating fails after merge. (operations, confidence 8)
- **fileReplacements is a new repo pattern:** Existing borrower-portal uses simple environment files without replacements. (operations, confidence 8)
- **CI job placement unclear:** Which job should contain the production grep check? (operations, confidence 7)

---

## Minor Findings

### Testing
- Incomplete test for normal retry throttle interaction (no outcome assertion)
- Missing test for invalid state passed to test hook
- Recovery notice banner priority not tested
- Existing test suite preservation not explicitly stated
- Keyboard navigation empty list edge case not tested

### Integration
- Class field declaration order confusing in Task 3 snippet (connectionState defined after observedConnectionState$)
- NotificationPanelService.isOpen()() double-call pattern unusual but valid
- Backend integration test auth pattern uncertainty acknowledged but fallback instruction vague

### Architect
- Missing barrel export for NotificationPanelConnectionState type
- App spec mock pattern needs alignment (existing mock uses string, new tests use enum)

### Operations
- Missing runtime validation for environment load (no confirmation log)
- CI placement and affected builds unclear

### Frontend
- Search-to-empty transition not implemented (wasSearchMatchBeforeHydrate)
- Change detection strategy not explicitly preserved in decorator

---

## Questions For Human

1. **Hook triggering real behavior:** Is it acceptable for the test connection hook to trigger real rehydration API calls? If not, what guard mechanism should prevent this?

2. **Retry throttle signals:** Should `forceRetryNotice` and `isRetryThrottled` signals ever be shown simultaneously, or should one suppress the other in panel UI?

3. **E2E auth file:** Does `apps/portal-web-e2e/.auth/acme-session.json` exist, or should tests use `session.json`?

4. **CI job placement:** Which job in main.yml should contain the production grep check? Should it run only when portal-web is affected, or always?

---

## Conflicts

None identified. Reviewers converged on similar concerns (backend test infrastructure, focus management, E2E infrastructure) without disagreement.

---

## Accepted Risks And Deferred Concerns

| Concern | Disposition | Reason |
|---------|-------------|--------|
| Skeleton timing UX polish | DEFERRED_TO_IMPLEMENTATION | Spec requirement but not blocking; can be added after core functionality |
| Connection banner icons | DEFERRED_TO_IMPLEMENTATION | Visual polish; text alone is sufficient for accessibility |
| Empty state sub-caption | DEFERRED_TO_IMPLEMENTATION | UX enhancement; not blocking |
| Search-to-empty transition | DEFERRED_TO_IMPLEMENTATION | UX edge case; can be added after core functionality |
| 1000+ events during disconnect duplicates | ACCEPTED_RISK | Documented POC limitation in spec review |
| Server-side rate limiting | DEFERRED_POST_SPRINT4 | Deferred hardening documented in spec review |

---

## Recommended Decision

**REVISE_PLAN**

5 critical blockers require resolution before implementation:
1. E2E hook type mismatch (tests will fail)
2. Backend test fixture class missing (tests cannot run)
3. Backend auth headers unrecognized (tests will fail at auth)
4. Roving tabindex blocks Tab navigation (accessibility violation)
5. Production grep path incorrect (CI verification will miss leaks)

After critical fixes, the plan is implementation-ready. Significant findings provide valuable guidance but do not block implementation — they should be incorporated as implementation notes or addressed during implementation where feasible.

---

## Implementation Guidance for Critical Fixes

### Fix 1: E2E Hook Type Mismatch
Modify Task 8 tests to use numeric HubConnectionState values:
```typescript
await page.evaluate(() => {
  window.__testConnectionStateOverride__(4); // Disconnected
});
await page.evaluate(() => {
  window.__testConnectionStateOverride__(1); // Connected
});
```

Or modify Task 3 hook to accept strings and map to enum values internally.

### Fix 2-3: Backend Test Infrastructure
Replace Task 4 `PortalApiFactory` with `WebApplicationFactory<Program>` pattern. Adapt `CreateAdminClient` to use `TestAuthHandler` with `TestUserContext` following `PrivilegeSecurityTests` pattern. Use `WebApplicationFactoryClientOptions.BaseAddress` for host-based tenant context.

### Fix 4: Roving Tabindex
Modify Task 6 Step 5 to ensure first visible item has `tabindex="0"`:
```typescript
// In component
readonly firstVisibleId = computed(() => this.filteredNotifications()[0]?.id);

// In template
[attr.tabindex]="(focusedNotificationIdForTest() ?? firstVisibleId()) === notification.id ? 0 : -1"
```

### Fix 5: Production Grep Path
Modify Task 9 Step 1 and Task 10 Step 4:
```bash
if rg -r "__testConnectionStateOverride__" dist/apps/portal-web; then exit 1; fi
```

Or target browser subdirectory explicitly:
```bash
if rg "__testConnectionStateOverride__" dist/apps/portal-web/browser; then exit 1; fi
```