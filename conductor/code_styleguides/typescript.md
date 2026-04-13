# Enterprise Frontend & Angular Architecture Mandates

You are the Frontend Specialist. You must strictly adhere to the following enterprise rules when writing Angular code in this workspace:

1. **Smart/Dumb Component Architecture:** 
   - `libs/ui/design-system`: Pure presentational "Dumb" components. Use Signal `input()`, `output()`, and Headless CDK logic. NO API calls.
   - `libs/features/*`: "Smart" components handling routing, state, and BFF integration.
2. **Reactivity & Change Detection:** 
   - We require `zone.js`. DO NOT migrate to zoneless. 
   - Use Angular Signals (`signal()`, `computed()`, `input()`) for state and DOM binding. Interop with RxJS using `toObservable` / `toSignal` for async event streams.
3. **Styling & CSP (Zero-Trust):** 
   - Strict Tailwind CSS 4.0 utility classes ONLY.
   - **Zero-Violation CSP:** Absolutely NO inline styles (`[style]`), NO `eval()`, and NO `<style>` blocks.
   - Use `@theme` CSS variables for multi-tenant branding. Ensure 44x44px minimum touch targets for mobile accessibility.
4. **Security & BFF Integration:** 
   - **Zero-JWT Policy:** The frontend NEVER sees or parses a JWT. Rely strictly on Secure/HTTP-Only cookies.
   - Integration with backend APIs must seamlessly support our DPoP (Demonstrating Proof-of-Possession) interceptors.
5. **Verifiable UI & Testing:** 
   - **TDD:** Write Vitest specs before implementation (Red-Green-Refactor methodology).
   - **Storybook Ledger:** All UI components MUST have a `.stories.ts` file featuring a `play` function (Interaction Test) to mathematically prove behavior and accessibility (Axe-core) before integration.

---

# Google TypeScript Style Guide Summary

This document summarizes key rules and best practices from the Google TypeScript Style Guide, which is enforced by the `gts` tool.

## 1. Language Features
- **Variable Declarations:** Always use `const` or `let`. **`var` is forbidden.** Use `const` by default.
- **Modules:** Use ES6 modules (`import`/`export`). **Do not use `namespace`.**
- **Exports:** Use named exports (`export {MyClass};`). **Do not use default exports.**
- **Classes:**
  - **Do not use `#private` fields.** Use TypeScript's `private` visibility modifier.
  - Mark properties never reassigned outside the constructor with `readonly`.
  - **Never use the `public` modifier** (it's the default). Restrict visibility with `private` or `protected` where possible.
- **Functions:** Prefer function declarations for named functions. Use arrow functions for anonymous functions/callbacks.
- **String Literals:** Use single quotes (`'`). Use template literals (`` ` ``) for interpolation and multi-line strings.
- **Equality Checks:** Always use triple equals (`===`) and not equals (`!==`).
- **Type Assertions:** **Avoid type assertions (`x as SomeType`) and non-nullability assertions (`y!`)**. If you must use them, provide a clear justification.

## 2. Disallowed Features
- **`any` Type:** **Avoid `any`**. Prefer `unknown` or a more specific type.
- **Wrapper Objects:** Do not instantiate `String`, `Boolean`, or `Number` wrapper classes.
- **Automatic Semicolon Insertion (ASI):** Do not rely on it. **Explicitly end all statements with a semicolon.**
- **`const enum`:** Do not use `const enum`. Use plain `enum` instead.
- **`eval()` and `Function(...string)`:** Forbidden.

## 3. Type Narrowing & Type Guards

In enterprise TypeScript, dealing with Union Types (e.g., `User | HttpErrorResponse`) is common. The Google Style Guide strictly forbids Type Assertions (`x as SomeType`) because they bypass the compiler and cause runtime crashes. Instead, you must use **Type Narrowing** and **Type Guards** to safely prove to the compiler what a type is.

### A. Built-in Type Guards
TypeScript recognizes standard JavaScript runtime checks and uses them to narrow types automatically.

*   **`typeof` (For Primitives):** Narrows basic JavaScript primitives (`string`, `number`, `boolean`, `function`).
    ```typescript
    function printId(id: string | number) {
      if (typeof id === 'string') {
        console.log(id.toUpperCase()); // TS knows 'id' is a string
      } else {
        console.log(id.toFixed(2));    // TS knows 'id' is a number
      }
    }
    ```
*   **`instanceof` (For Classes):** Narrows objects instantiated from a `class` (does *not* work for `interface` or `type`).
    ```typescript
    function handleError(error: Error | HttpErrorResponse) {
      if (error instanceof HttpErrorResponse) {
        console.log(`API Failed with status: ${error.status}`); // Safe access
      }
    }
    ```
*   **`in` Operator (For Interfaces/Objects):** Checks if a specific property key exists in an object.
    ```typescript
    interface Admin { role: string; privileges: string[]; }
    interface Customer { role: string; subscriptionId: string; }

    function routeUser(user: Admin | Customer) {
      if ('privileges' in user) {
        user.privileges.forEach(p => console.log(p)); // TS knows it's an Admin
      }
    }
    ```

### B. Custom Type Guard Functions (`is`)
When extraction complex type-checking logic into a reusable function, a simple `boolean` return type isn't enough for TypeScript to narrow the type. You must use a **Type Predicate** (`arg is Type`).

```typescript
interface SecurityEvent { eventId: string; timestamp: string; }
interface LoginAnomalyEvent extends SecurityEvent { reason: string; }

// Custom Type Guard using 'is'
function isLoginAnomaly(event: SecurityEvent): event is LoginAnomalyEvent {
  return 'reason' in event;
}

function processEvent(event: SecurityEvent) {
  if (isLoginAnomaly(event)) {
    console.log(`Alert: ${event.reason}`); // TS knows it is a LoginAnomalyEvent
  }
}
```

### C. Discriminated Unions (The Enterprise Standard)
When managing complex state (like Angular feature stores), use a Discriminated Union. Give every interface in the union a common, literal property (e.g., `status`).

```typescript
interface LoadingState { status: 'loading'; }
interface SuccessState { status: 'success'; data: User[]; }
interface ErrorState   { status: 'error'; errorMessage: string; }

type StoreState = LoadingState | SuccessState | ErrorState;

function renderUI(state: StoreState) {
  switch (state.status) {
    case 'loading':
      showSpinner();
      break;
    case 'success':
      renderTable(state.data); // TS knows this is SuccessState
      break;
    case 'error':
      showErrorToast(state.errorMessage);
      break;
    default:
      // Exhaustiveness checking! Warns if a new status is added to StoreState.
      const _exhaustiveCheck: never = state;
  }
}
```

## 4. Naming
- **`UpperCamelCase`:** For classes, interfaces, types, enums, and decorators.
- **`lowerCamelCase`:** For variables, parameters, functions, methods, and properties.
- **`CONSTANT_CASE`:** For global constant values, including enum values.
- **`_` Prefix/Suffix:** **Do not use `_` as a prefix or suffix** for identifiers, including for private properties.

## 5. Type System
- **Type Inference:** Rely on type inference for simple, obvious types. Be explicit for complex types.
- **`undefined` and `null`:** Both are supported. Be consistent within your project.
- **Optional vs. `|undefined`:** Prefer optional parameters and fields (`?`) over adding `|undefined` to the type.
- **`Array<T>` Type:** Use `T[]` for simple types. Use `Array<T>` for more complex union types (e.g., `Array<string | number>`).
- **`{}` Type:** **Do not use `{}`**. Prefer `unknown`, `Record<string, unknown>`, or `object`.

## 6. Comments and Documentation
- **JSDoc:** Use `/** JSDoc */` for documentation, `//` for implementation comments.
- **Redundancy:** **Do not declare types in `@param` or `@return` blocks** (e.g., `/** @param {string} user */`). This is redundant in TypeScript.
- **Add Information:** Comments must add information, not just restate the code.

*Source: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)*