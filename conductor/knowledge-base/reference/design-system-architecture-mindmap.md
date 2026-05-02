---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Design System Architecture**

## **1. System Architecture**

### **1.1 Layers**
1. Foundations
   - color
   - typography
   - spacing
   - radius
   - shadow
   - breakpoints
2. Tokens
   - primitive
   - semantic
   - component
3. Components
   - atoms
   - molecules
   - organisms
4. Patterns
   - workflows
   - interaction models
   - accessibility contracts
5. Governance
   - docs
   - tests
   - releases
   - deprecations

### **1.2 Atomic Taxonomy**
1. Atoms
   - button
   - input
   - label
   - checkbox
   - icon
2. Molecules
   - form-field
   - dropdown-menu
   - toast
   - dialog
3. Organisms
   - data-table
   - transfer-list
   - app-shell
   - notification-panel
4. Rule
   - lower tiers compose upward
   - design system avoids product data fetching

### **1.3 Governance**
1. Contribution criteria
2. API review
3. Token review
4. Storybook requirements
5. Versioning
6. Migration policy

## **2. Tokens and Theming**

### **2.1 Design Tokens**
1. Machine-readable design decisions
   - color
   - dimension
   - typography
   - radius
   - shadow
   - motion
2. Not every pixel
   - tokenize decisions
   - avoid token sprawl

### **2.2 Token Layers**
1. Primitive
   - raw palette/scale
   - `--color-blue-600`
2. Semantic
   - product meaning
   - `--color-action-primary`
3. Component
   - component mapping
   - `--button-primary-bg`
4. Benefit
   - themeability
   - stable APIs
   - brand agility

### **2.3 Tailwind 4**
1. `@theme`
   - token values
   - generated utility classes
2. Namespaces
   - `--color-*`
   - `--spacing-*`
   - `--radius-*`
   - `--breakpoint-*`
3. CSS variables
   - runtime aliases
   - tenant themes
   - dark mode

### **2.4 Multi-Tenant Theming**
1. Runtime CSS variables
2. Scoped by tenant/theme
   - `[data-tenant]`
   - `[data-theme]`
3. Required validation
   - contrast
   - focus
   - disabled states
   - dark/high-contrast

### **2.5 CSP-Safe Styling**
1. Build-time CSS
2. Class-based state
3. CSS variables from stylesheets
4. Avoid
   - inline styles
   - runtime style injection
   - unsafe innerHTML
   - arbitrary style APIs

## **3. Component API Design**

### **3.1 Public Surface**
1. Inputs
   - typed
   - semantic
   - safe defaults
2. Outputs
   - user intent
   - not DOM mechanics
3. Projection
   - controlled extension points
4. Test hooks
   - stable when needed

### **3.2 Variants and State**
1. Prefer variants
   - primary
   - secondary
   - danger
2. Avoid boolean explosions
3. Model state explicitly
   - disabled
   - invalid
   - loading
   - selected
   - expanded

### **3.3 Composition**
1. Content projection
2. Template refs
3. Slots with contracts
4. Risks
   - broken accessibility
   - kitchen-sink APIs
   - inconsistent visuals

### **3.4 Accessibility**
1. Role
2. Label
3. Keyboard behavior
4. Focus management
5. Error/hint association
6. Assistive state

### **3.5 Angular Patterns**
1. Standalone components
2. OnPush
3. signal inputs
4. computed state
5. output events
6. no product data fetching
7. no inline styles

## **4. Storybook and Verification**

### **4.1 Story Architecture**
1. CSF typed stories
2. Args and controls
3. Autodocs
4. States
   - default
   - loading
   - error
   - disabled
   - long text
   - responsive
   - dark/high contrast

### **4.2 Interaction Tests**
1. Play functions
2. User events
3. Assertions
4. Contract tests
   - emits events
   - keyboard works
   - disabled blocks actions

### **4.3 Accessibility Tests**
1. Axe checks
2. Labels
3. Roles
4. Focus-visible
5. Contrast
6. Keyboard traps

### **4.4 Security Guardrails**
1. No `[style]`
2. No unsafe `innerHTML`
3. No runtime CSS injection
4. No secrets in stories
5. CSP regression tests

## **5. Enterprise Operations**

### **5.1 Versioning**
1. Semver
2. Changelog
3. Deprecations
4. Migration docs
5. Codemods

### **5.2 Performance**
1. Tree shaking
2. Secondary entry points
3. Lazy heavy organisms
4. Per-icon imports
5. OnPush/signals
6. Virtualization

### **5.3 Adoption**
1. Inventory repeated UI
2. Extract atoms/molecules
3. Codify tokens
4. Replace high-churn components
5. Add Storybook guardrails
6. Migrate organisms
7. Deprecate old UI

## **6. Interview Framing**

### **6.1 Senior Summary**
1. Design system is a UI platform
2. Tokens are architecture, not decoration
3. Components expose semantic APIs
4. Storybook is executable documentation
5. Governance prevents entropy
6. CSP and accessibility are first-class constraints

### **6.2 Anti-Patterns**
1. Token sprawl
2. Boolean prop explosion
3. Class/style escape hatches
4. Business logic in shared components
5. Happy-path-only stories
6. Big-bang migrations
