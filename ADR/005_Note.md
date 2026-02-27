# Day 5 Summary: The Secure Dashboard Shell & UI Invariants

## 1. Executive Summary
On Day 5, we moved beyond individual identity components to build the **App Shell**—the primary frame that holds our entire banking portal. We implemented two critical navigation components: the **Sidebar** and the **User Profile Widget**. The focus was on building a UI that is not only beautiful but also **"Audit-Proof"** regarding security (CSP) and accessibility (WCAG).

## 2. Key Knowledge Points (The "Why" and "How")

### A. Headless UI (Angular CDK) vs. Angular Material
*   **What we did:** We used "headless" primitives from the Angular Component Dev Kit (CDK) instead of pre-styled Angular Material components.
*   **Why we did it (The Junior Dev takeaway):** 
    *   **Strict CSP:** Many UI libraries (like Material) inject "inline styles" directly into the HTML to handle positioning. Our security policy (Content Security Policy) **blocks all inline styles** to prevent hackers from injecting malicious CSS. By using the CDK + our own SCSS files, we maintain 100% control over the styles, ensuring they are loaded from safe, external files.
    *   **Zero-Trust Posture:** We don't want our UI library to have "magic" powers. By building our own components on top of CDK primitives, we ensure the UI remains a "dumb" presentational layer that doesn't touch sensitive tokens (JWTs) directly.

### B. High-Performance Reactivity (OnPush)
*   **What we did:** Every component uses `ChangeDetectionStrategy.OnPush`.
*   **Why we did it:** In a standard Angular app, the framework checks the *entire* screen for changes every time something happens (like a mouse move). In a complex banking dashboard, this is slow. `OnPush` tells Angular: "Only check this component if its inputs change." This is essential for our "Zoneless" future, ensuring the app stays snappy even with thousands of data updates.

### C. Mathematical Proofs in Storybook (Interaction Tests)
*   **What we did:** We wrote `play` functions in Storybook to automate the verification of our UI.
*   **How it works:** 
    1.  **Sidebar Audit:** We mathematically prove that when the sidebar is "Collapsed," the text labels are physically removed from the DOM (using `*ngIf`), not just hidden with CSS. This ensures screen readers don't read out hidden text.
    2.  **Identity Invariant Audit:** We prove that the name "John Doe" *always* results in the initials "JD" on the profile button. 
    3.  **Portal Verification:** Since the Angular CDK renders menus in a "Portal" (a layer outside the component), our tests verify that the "Logout" button actually appears in that global overlay.

## 3. Implementation Details for Junior Developers

### The Sidebar Structure
We used a simple, semantic structure:
```html
<nav class="sidebar">
  <ul cdkMenu> <!-- The CDK handles all the complex keyboard logic -->
    <li cdkMenuItem> <!-- Users can navigate this with Arrow Keys automatically! -->
      <button>Collections</button>
    </li>
  </ul>
</nav>
```
**Pro Tip:** Always use `<button type="button">` for menu items instead of `<a>` tags if they don't navigate to a new page. It's much better for accessibility!

### Deriving User Initials
Instead of the backend sending "JD", it sends the full name. Our component calculates the initials dynamically. This keeps our data "Pure" and lets the UI decide how to display it.

## 4. Why This Adheres to Requirements
1.  **Zero-Trust:** The UI never sees a JWT. It only sees a "User Profile" object.
2.  **Strict CSP:** 0% inline styles. 100% SCSS.
3.  **Accessibility:** Automated focus management provided by the Angular CDK means we don't have to manually code complex "Tab" and "Arrow Key" logic.

---
**Status**: Day 5 Features Fully Implemented and Documented.
**Next Steps**: Transition to Phase 2 - Multi-Tenancy and Data Isolation.
