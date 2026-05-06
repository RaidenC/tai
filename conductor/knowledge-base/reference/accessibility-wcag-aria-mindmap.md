---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Accessibility — WCAG 2.2 + ARIA**

## **1. Strategy**

### **1.1 WCAG 2.2**
1. Product contract
   - perceivable
   - operable
   - understandable
   - robust
2. New 2.2 focus
   - focus not obscured
   - target size
   - dragging alternatives
   - redundant entry
   - accessible authentication
3. FinTech baseline
   - WCAG 2.2 AA
   - critical workflows first

### **1.2 Semantic HTML**
1. Native first
   - button
   - link
   - label
   - input
   - nav/main
2. Benefit
   - built-in role
   - keyboard behavior
   - accessible name
3. Anti-pattern
   - clickable div
   - hidden focus
   - fake disabled state

### **1.3 ARIA Contract**
1. Roles
2. States
3. Relationships
4. Keyboard model
5. Focus model

### **1.4 Assistive Tech Reality**
1. Automated tools are limited
2. Manual screen-reader testing required
3. Task testing beats isolated inspection

## **2. Keyboard and Focus**

### **2.1 Keyboard Operability**
1. Tab order
2. Enter/Space activation
3. Escape closing
4. Arrow-key composites
5. No keyboard traps

### **2.2 Focus Management**
1. Menu opens
   - focus first item
2. Menu closes
   - restore trigger
3. Dialog opens
   - focus inside
4. Form error
   - first invalid field or summary
5. Route changes
   - focus heading/main

### **2.3 Focus Visibility**
1. WCAG 2.2 focus criteria
2. Avoid obscuring
3. High-contrast rings
4. Test sticky headers and overlays

### **2.4 Landmarks**
1. `main`
2. labelled `nav`
3. route `h1`
4. breadcrumbs
5. planned skip link

## **3. ARIA Patterns**

### **3.1 Menu Button**
1. Trigger
   - native button
   - `aria-haspopup`
   - `aria-expanded`
2. Menu
   - `role="menu"`
   - `role="menuitem"`
3. Keyboard
   - Enter/Space
   - arrows
   - Home/End
   - Escape
4. tai-portal example
   - `DropdownMenuComponent`

### **3.2 Form Errors**
1. `aria-invalid`
2. `aria-describedby`
3. stable ids
4. live region
5. focus recovery

### **3.3 Dialogs and Alerts**
1. CDK dialog
2. role alert
3. polite vs assertive
4. dismiss button name
5. restore focus

### **3.4 Icons**
1. Decorative
   - `aria-hidden`
2. Informative
   - `role="img"`
   - `aria-label`
3. Icon-only buttons
   - label on button

## **4. Enterprise UI**

### **4.1 Forms**
1. Labels
2. Instructions
3. autocomplete
4. grouped controls
5. error summary
6. accessible authentication

### **4.2 Tables and Lists**
1. Sortable headers
2. Row action names
3. Loading/empty status
4. Pagination controls
5. Virtualized widgets need manual testing

### **4.3 Target and Pointer Access**
1. Target size
   - 24 by 24 CSS px minimum concept
2. Drag alternatives
3. Dense UI spacing
4. Destructive action spacing

### **4.4 Authentication**
1. Password managers
2. Passkeys
3. OTP paste
4. Avoid cognitive-only challenges
5. Clear recovery paths

## **5. Testing and Governance**

### **5.1 Automated**
1. Component unit tests
2. Storybook axe
3. Playwright axe
4. Keyboard E2E
5. ARIA attribute checks

### **5.2 Manual**
1. NVDA
2. JAWS
3. VoiceOver macOS
4. VoiceOver iOS
5. Task scripts

### **5.3 Design-System Gates**
1. Semantics documented
2. Keyboard tested
3. Focus tested
4. Screen-reader notes
5. No permanent skips

### **5.4 Risk Model**
1. Critical
   - sign-in
   - MFA
   - claims
   - signing
2. High
   - admin forms
   - tables
   - approvals
3. Medium/Low
   - dashboards
   - mocks
   - diagnostics
