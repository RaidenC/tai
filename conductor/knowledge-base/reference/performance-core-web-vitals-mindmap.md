---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Performance & Core Web Vitals**

## **1. Core Web Vitals**

### **1.1 LCP**
1. Loading metric
   - largest visible element
   - target <= 2.5s
   - measured at p75
2. Common causes
   - large initial JS
   - blocking CSS/fonts
   - slow hero/image
   - API-gated first render
3. tai-portal focus
   - sign-in
   - claim start
   - dashboards

### **1.2 INP**
1. Responsiveness metric
   - replaced FID
   - target <= 200ms
   - evaluates interactions across lifecycle
2. Common causes
   - long main-thread tasks
   - heavy event handlers
   - large DOM updates
   - client-side filtering/sorting
3. tai-portal focus
   - forms
   - tables
   - transfer lists
   - approval actions

### **1.3 CLS**
1. Stability metric
   - target <= 0.1
   - unexpected movement
2. Common causes
   - missing image dimensions
   - late banners
   - unstable loading states
   - font swaps
3. tai-portal focus
   - claim steps
   - admin forms
   - data tables

### **1.4 Field and Lab Data**
1. Field data
   - real users
   - route patterns
   - app versions
2. Lab data
   - repeatable traces
   - Lighthouse
   - Playwright
3. Budgets
   - bundle limits
   - route targets
   - regression gates

## **2. Loading Architecture**

### **2.1 Lazy Loading**
1. Route-level splitting
   - `loadComponent`
   - standalone routes
2. Real examples
   - `portal-web` admin routes
   - borrower claim steps
3. Senior concern
   - split by workflow
   - avoid shared dependency leakage
   - preload likely next routes

### **2.2 Bundle Analysis**
1. Current budgets
   - initial 500kb warning
   - initial 1mb error
   - component style limits
2. Missing workflow
   - analyzer script
   - stats artifact
   - per-route chunk review
3. High-risk dependencies
   - PDF
   - DocuSign
   - charts
   - rich text

### **2.3 Critical Rendering Path**
1. Startup chain
   - HTML
   - CSS/fonts
   - app bootstrap
   - route chunk
   - first data
2. Optimization pattern
   - render shell early
   - load data progressively
   - defer non-critical panels

## **3. Runtime Rendering**

### **3.1 OnPush**
1. Bounded change detection
   - input reference changes
   - events
   - signals
2. tai-portal examples
   - DataTable
   - AppShell
   - Input
   - TransferList
3. Gotcha
   - input mutation
   - huge DOM still hurts

### **3.2 Signals**
1. Fine-grained state
   - `signal`
   - `computed`
   - explicit dependencies
2. Real examples
   - displayed columns
   - pagination summary
   - filtered transfer lists
3. Limits
   - expensive computed work
   - large arrays
   - synchronous handlers

### **3.3 Virtual Scrolling**
1. Render visible subset
2. Real example
   - TransferList CDK viewport
   - fixed item size
   - trackBy
3. Trade-offs
   - accessibility
   - E2E selectors
   - find-in-page

## **4. Asset and Layout Stability**

### **4.1 Images and Fonts**
1. Current gap
   - no `NgOptimizedImage`
   - no web-vitals image policy
2. Plan
   - dimensions/aspect ratio
   - priority only for LCP image
   - lazy non-critical images
   - font-display policy

### **4.2 Stable Layout**
1. Reserve dimensions
   - skeletons
   - min heights
   - stable headers/actions
2. Real examples
   - DataTable min height
   - TransferList fixed viewport
3. Avoid
   - tiny spinner replacement
   - late banners above content

### **4.3 Animations**
1. Prefer
   - transform
   - opacity
2. Avoid
   - layout dimensions
   - broad `transition-all`
3. Review surfaces
   - sidebars
   - toasts
   - dialogs
   - notification panels

## **5. Governance**

### **5.1 Measurement Workflow**
1. Capture field data
2. Reproduce in lab
3. Identify bottleneck
4. Fix one hypothesis
5. Verify and guard

### **5.2 Regression Gates**
1. Angular budgets
2. Bundle analyzer artifacts
3. Lighthouse or Playwright smoke
4. Storybook interactions
5. Dependency review

### **5.3 FinTech Risk Model**
1. Critical routes
   - sign-in
   - MFA
   - claim submission
   - signing
2. High routes
   - admin tables
   - approvals
   - privilege management
3. Rule
   - heavy route code stays out of critical startup paths
