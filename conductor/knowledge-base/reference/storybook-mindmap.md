---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Storybook**

## **1. Strategic Role**

### **1.1 Component Workbench**
1. Isolated rendering
   - component outside app routes
   - controlled args
   - controlled providers
2. Solves expensive app setup
   - no auth/data workflow needed
   - rare states are easy to inspect
3. FinTech value
   - invalid forms
   - destructive actions
   - disabled approvals
   - empty tables

### **1.2 Contract System**
1. Stories define public behavior
   - inputs
   - outputs
   - states
   - events
2. Contract tools
   - `args`
   - `argTypes`
   - `play`
   - `autodocs`
3. Anti-pattern
   - default screenshot only
   - fake happy path
   - no failure states

### **1.3 Compliance Evidence**
1. Security states
   - password attributes
   - escaped error content
   - destructive confirmations
2. Accessibility states
   - roles
   - labels
   - keyboard
   - focus
3. Policy states
   - no inline styles
   - strict CSP surface
   - Trusted Types awareness

## **2. tai-portal Architecture**

### **2.1 Versions**
1. Storybook 8.6.18
2. `@storybook/angular`
3. `@storybook/test`
4. `@storybook/addon-a11y`
5. `@storybook/addon-interactions`
6. `@nx/storybook` 22.5.1

### **2.2 Nx Targets**
1. `design-system:storybook`
   - port 6006
   - config dir
   - tsconfig
   - portal-web build target
2. `design-system:build-storybook`
   - static build
   - CI artifact

### **2.3 Storybook Config**
1. `main.ts`
   - story glob
   - addons
   - Angular framework
2. `preview.ts`
   - autodocs
   - controls
3. `test-runner.ts`
   - axe
   - CSP inline-style guard

## **3. Story Patterns**

### **3.1 State Matrix**
1. Default
2. Loading
3. Empty
4. Error
5. Disabled
6. Destructive
7. Long content

### **3.2 Interaction Audit**
1. Uses `play`
2. Uses `userEvent`
3. Uses role/testid queries
4. Proves behavior
   - sort
   - paginate
   - submit
   - confirm/cancel

### **3.3 Security Stories**
1. Secure input
   - autocomplete
   - password type
   - escaped HTML
2. Strict CSP demo
   - composed surface
   - violation listener
3. Confirmation dialog
   - destructive state
   - deliberate action

### **3.4 Accessibility Stories**
1. Role-based queries
2. Accessible names
3. Disabled behavior
4. Alert/error states
5. Keyboard paths

## **4. Testing and CI**

### **4.1 Test Runner**
1. Runs stories in browser
2. Executes `play`
3. Runs hooks
4. Fails CI on contract breaks

### **4.2 Axe**
1. Inject before visit
2. Check after visit
3. Detailed report
4. Baseline gate

### **4.3 CSP Guard**
1. Query `#storybook-root [style]`
2. Fail on inline styles
3. Enforce class-based styling
4. Protect strict FinTech policy

### **4.4 Regression Strategy**
1. Unit tests
   - logic
   - internals
2. Storybook tests
   - rendered contracts
   - a11y
   - CSP
3. E2E tests
   - app workflows
   - auth
   - backend integration

## **5. Governance**

### **5.1 Promotion Criteria**
1. Typed API
2. State matrix
3. Interaction audit
4. A11y proof
5. CSP proof
6. Unit tests
7. Autodocs

### **5.2 Security Workflow**
1. Sensitive inputs
2. Escaped content
3. No unsafe styles
4. No unsafe HTML
5. Deliberate destructive actions

### **5.3 Accessibility Workflow**
1. Roles
2. Labels
3. Keyboard
4. Focus
5. Disabled
6. Error association

### **5.4 Operational Scaling**
1. Taxonomy
   - Atoms
   - Molecules
   - Organisms
   - Security
2. Stable naming
3. CI gates
4. Visual baselines for mature components
5. Periodic pruning

## **6. Interview Frames**

### **6.1 Junior**
1. Storybook renders components outside the app
2. A story is one named component state

### **6.2 Mid-Level**
1. Storybook complements app pages
2. Stories complement unit tests
3. Use stories for states and interactions

### **6.3 Senior**
1. Treat stories as contracts
2. Add a11y and CSP gates
3. Balance CI confidence and cost

### **6.4 Staff**
1. Split library and app Storybooks
2. Govern promotion criteria
3. Use Storybook as design-system infrastructure
