# SWBC Payment Protection & Borrower Portal - Interview Prep & POC Guide

This document captures the complete architectural discussion and strategy for discussing, defending, and prototyping the **SWBC Payment Protection Borrower Portal** for Senior/Staff Engineering interviews in 2026.

---

## 1. Project Context & Real-World Reality

The **SWBC Payment Protection Borrower Portal** is a digital platform launched in early 2026. SWBC partners with financial institutions (banks and credit unions) to offer "Payment Protection" insurance products (debt cancellation, credit insurance). These kick in if a borrower experiences a life event that prevents them from paying their loan—such as involuntary unemployment, disability, or loss of life.

**Key Features (Based on 2026 Press Releases):**
*   **Digital Claim Submission:** Borrowers complete the claims process entirely online, replacing paper forms.
*   **Document Uploads:** Electronic upload of supporting documentation (medical records, termination letters).
*   **Fillable Forms & E-Signature:** Dynamic generation of fillable PDF claim forms (including Spanish-language support) integrated with e-signature technology.
*   **Self-Service Tracking:** Borrowers can track claim status independently, reducing lender call-center volume.

**Executive Sponsors:**
*   Joan Cleveland, President and CEO of SWBC Life Insurance Company.
*   Melissa Piehl, Director of Payment Protection Claims.

---

## 2. Why This Project Demands NgRx (The Interview Pitch)

In an interview, you must defend *why* you used NgRx instead of simple local component state (like Angular Signals).

**The Problem:**
Complex, multi-page workflows (like filling out financial/borrower data, mapping it to a PDF, and signing it) require the frontend to hold onto a massive amount of "Draft" state while the user navigates between 4 or 5 different Angular routes/pages. Component-level state is destroyed when the user navigates to the next page.

**The NgRx Solution:**
NgRx lives outside the components at the global level. It acts as the single source of truth for the "Borrower Application Draft", allowing the user to navigate back and forth without losing data. 

### Defending Against "Over-Engineering"
If an interviewer asks, *"Isn't NgRx massive over-engineering for a form?"*, you justify it with three specific requirements:

1.  **The "Re-Inventing the Wheel" Argument (localStorage Sync):** 
    Users must not lose their 10-page draft if they accidentally close the browser. Doing this manually requires writing `localStorage` logic on every keystroke. With NgRx, you write a single **Meta-Reducer** (10 lines of code) that wraps the entire global store and automatically dumps every state change to `localStorage`. NgRx actually *saves* you from writing boilerplate infrastructure code.
2.  **Complex Derived State (Memoized Selectors):** 
    The "Next" button on Step 3 is only enabled if Step 1 is valid, Step 2 is not null, and Step 3 is checked. NgRx Selectors (`createSelector(selectBorrower, selectPlan, ...)`) provide mathematically perfect, memoized derived state across completely different routes.
3.  **The "Back Button" Problem (Time-Travel Debugging):**
    When users jump backward and forward through a multi-step financial wizard, state often gets corrupted. NgRx Redux DevTools allow you to rewind the application step-by-step to see exactly when data was corrupted, saving hours of debugging.

---

## 3. Why Not a Single-Page Infinite-Scroll Form?

A Staff-level interviewer will challenge: *"Why not just put all 100 fields on a single page and avoid NgRx completely?"*

1.  **UX "Cognitive Overload":** A single endless wall of 100 financial input fields causes massive user drop-off. Chunking it into a Wizard (Step 2 of 5) creates psychological momentum and dramatically improves completion rates.
2.  **Analytics & Abandonment Tracking:** Fintech companies need to know *where* users drop off. Distinct URL routes (`/apply/financial`, `/apply/medical`) provide free, granular Google Analytics funnel tracking.
3.  **Deep Linking & Resumability:** If an applicant forgets to sign, an email reminder can deep-link them directly to `/apply/sign`. NgRx instantly hydrates the draft from `localStorage` or the API, dropping them exactly where they need to be.
4.  **The "God Component" Performance Problem:** Putting 100 form controls, 5 API calls, and branching validation logic into one Angular component creates an untestable, slow 3,000-line file. Routing enforces modularity; NgRx acts as the glue.

---

## 4. POC Blueprint: The 4-Step Disability Claim

To prove this architecture, you can build a POC in 1-2 days using AI (Claude Code/Opus). We focus on **Disability (Medical Leave/Injury)** because it has complex branching logic, arrays of objects, and multi-document uploads—perfectly demonstrating NgRx's power.

### The NgRx State Model (`DisabilityClaimDraft`)
```typescript
export interface DisabilityClaimDraft {
  claimId: string | null;
  currentStep: number;
  
  // Step 1
  borrower: { firstName: string; lastName: string; ssnLastFour: string; phone: string; email: string; };
  
  // Step 2
  incident: { dateOfDisability: string; disabilityType: 'Illness' | 'Injury' | 'Pregnancy'; isWorkRelated: boolean; description: string; };

  // Step 3 (Array of objects!)
  medicalProviders: Array<{ id: string; doctorName: string; clinicName: string; phone: string; dateFirstTreated: string; }>;

  // Step 4
  documents: { employerLeaveFormId: string | null; attendingPhysicianStatementId: string | null; };

  isSubmitting: boolean;
  error: string | null;
}
```

### The UI Steps

**Step 1: Borrower Verification (`/claim/borrower-info`)**
*   **Fields:** Name, SSN, Phone, Email.
*   **NgRx Flex:** Dispatches `saveBorrowerInfo`. The Meta-Reducer writes to `localStorage`. Refreshing the page instantly rehydrates the form.

**Step 2: Incident Details (`/claim/incident-details`)**
*   **Fields:** Date, Cause (Illness/Injury/Pregnancy), "Did this happen at work?" (Conditional), Description.
*   **NgRx Flex:** Conditional logic. An NgRx Selector (`selectIsWorkRelated`) detects if "Injury at Work" is true, and an NgRx Effect automatically fetches the "Workers Comp Form Template" in the background while the user is typing.

**Step 3: Medical Providers (`/claim/medical-providers`)**
*   **Fields:** Dynamic array of doctors. "+ Add Another Doctor".
*   **NgRx Flex:** Managing dynamic `FormArray` data across route changes is notoriously buggy. NgRx manages the array perfectly via `addProvider` and `removeProvider` actions.

**Step 4: Documentation & Signature (`/claim/review-and-sign`)**
*   **Fields:** File Uploads, PDF Preview, Checkbox, Submit.
*   **NgRx Flex:** When clicking "Submit", an **NgRx Effect** uses the `withLatestFrom(store.select(selectClaimDraft))` operator to grab the entire 4-page payload from the store in one shot, packages it, and fires the POST request. It catches errors safely without destroying the user's draft.

---

## 5. Monorepo Integration Strategy

To show maximum architectural maturity, the POC should be built as a separate application *inside* the existing `tai-portal` Nx Monorepo.

**The Interview Pitch:**
> *"When we needed to spin up the Borrower Portal POC, I didn't start from scratch. Because I had architected our ecosystem as an Nx Monorepo, I generated a new Angular application and instantly reused our hardened, strict-CSP compliant UI components from our shared Design System library. This cut development time by 60%."*

**Nx Folder Structure:**
```text
tai-portal/
├── apps/
│   ├── portal-web/             # Internal Admin app
│   ├── borrower-portal/        # External Customer app (The POC)
│   └── portal-api/             # Shared .NET Backend
├── libs/
│   ├── ui/design-system/       # Shared UI components (used by BOTH apps!)
│   ├── features/disability-claim/ # The NgRx Wizard code
│   └── core/                   # Shared domain models
```

**Commands to Scaffold:**
1.  `nx g @nx/angular:app apps/borrower-portal --routing --style=scss --standalone`
2.  `nx g @nx/angular:lib libs/features/disability-claim --routing --standalone`
3.  Lazy-load the library into the app routing, and import UI buttons/inputs directly from the `design-system` library.