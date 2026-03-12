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

## 3. Naming
- **`UpperCamelCase`:** For classes, interfaces, types, enums, and decorators.
- **`lowerCamelCase`:** For variables, parameters, functions, methods, and properties.
- **`CONSTANT_CASE`:** For global constant values, including enum values.
- **`_` Prefix/Suffix:** **Do not use `_` as a prefix or suffix** for identifiers, including for private properties.

## 4. Type System
- **Type Inference:** Rely on type inference for simple, obvious types. Be explicit for complex types.
- **`undefined` and `null`:** Both are supported. Be consistent within your project.
- **Optional vs. `|undefined`:** Prefer optional parameters and fields (`?`) over adding `|undefined` to the type.
- **`Array<T>` Type:** Use `T[]` for simple types. Use `Array<T>` for more complex union types (e.g., `Array<string | number>`).
- **`{}` Type:** **Do not use `{}`**. Prefer `unknown`, `Record<string, unknown>`, or `object`.

## 5. Comments and Documentation
- **JSDoc:** Use `/** JSDoc */` for documentation, `//` for implementation comments.
- **Redundancy:** **Do not declare types in `@param` or `@return` blocks** (e.g., `/** @param {string} user */`). This is redundant in TypeScript.
- **Add Information:** Comments must add information, not just restate the code.

*Source: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)*