---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **Reactive Forms & Custom Controls**

## **1. Core Form Architecture**

### **1.1 Reactive Forms Mental Model**
1. Explicit control tree
   - `FormControl`
   - `FormGroup`
   - `FormArray`
   - `FormRecord`
2. Observable state
   - value
   - status
   - touched
   - dirty
   - pending
3. Enterprise value
   - testable validation
   - deterministic submission
   - route-safe rehydration

### **1.2 Typed Forms**
1. Strong value model
   - `nonNullable`
   - `getRawValue`
   - fewer unsafe casts
2. Submission safety
   - disabled fields are deliberate
   - DTO mapping is explicit
3. tai-portal example
   - `LoginFormComponent`
   - `RegistrationFormComponent`
   - `OtpVerificationFormComponent`

### **1.3 State Boundaries**
1. Form owns active editing
2. Signals own local UI flags
3. Store owns workflow recovery
4. Server owns durable truth
5. Avoid dual ownership
   - no store patch while user types
   - use `emitEvent: false` for hydration

## **2. Custom Control Architecture**

### **2.1 ControlValueAccessor**
1. Adapter contract
   - `writeValue`
   - `registerOnChange`
   - `registerOnTouched`
   - `setDisabledState`
2. Design-system role
   - custom controls act like native inputs
   - parent forms own validation
3. tai-portal examples
   - `InputComponent`
   - `CheckboxComponent`
   - `SecureInputComponent`
   - `TransferListComponent`

### **2.2 State Semantics**
1. Disabled
   - not just CSS
   - blocks interaction
2. Touched
   - blur or meaningful interaction
   - controls error visibility
3. Dirty
   - user changed value
   - supports unsaved-change decisions
4. Pending
   - async validation running
   - submit should wait

### **2.3 Accessible Errors**
1. Connect control to message
   - `aria-invalid`
   - `aria-describedby`
   - role alerts where appropriate
2. Safe rendering
   - no untrusted HTML
   - text or Trusted Types
3. Review focus behavior
   - first invalid field
   - long-form error summary

## **3. Validation Architecture**

### **3.1 Synchronous Validators**
1. Pure local rules
   - required
   - email
   - pattern
   - length
2. Custom validators
   - stable error keys
   - unit tested
3. Security frame
   - client validation is UX
   - server validates authority

### **3.2 Cross-Field Validators**
1. Group-level relationships
   - matching values
   - date ranges
   - conditional requirements
2. Presentation challenge
   - group invalid
   - fields may appear valid
3. tai-portal fit
   - treatment date after disability date
   - signing eligibility rules

### **3.3 Async Validators**
1. Server-backed checks
   - uniqueness
   - tenant policy
   - invitation status
2. Safety requirements
   - generic messages
   - rate limits
   - `updateOn: 'blur'`
   - respect `pending`
3. tai-portal plan
   - registration email policy
   - no account enumeration

## **4. Dynamic and Enterprise Forms**

### **4.1 FormArray**
1. Runtime collections
   - add
   - remove
   - reorder
2. Borrower portal example
   - medical providers
   - max 5
   - NgRx sync
3. Hardening plan
   - typed array groups
   - central DTO mapping
   - scoped subscriptions

### **4.2 Server-Backed Dynamic Forms**
1. Metadata-driven fields
   - labels
   - validators
   - options
   - visibility
2. Good fit
   - optional supplements
   - tenant questionnaires
3. Poor fit
   - core identity
   - signing
   - authorization
4. Platform cost
   - versioning
   - localization
   - audit
   - accessibility

### **4.3 Security-Sensitive Forms**
1. Sensitive inputs
   - password
   - SSN last four
   - claim identifiers
   - signed document metadata
2. Secure controls
   - autocomplete decisions
   - safe error text
   - strict CSP compatibility
3. Minimize persistence
   - no secrets in logs
   - no unnecessary client durability

## **5. Testing and Governance**

### **5.1 Unit Tests**
1. Control construction
2. Validators
3. Submission payload
4. CVA integration
5. Disabled and touched behavior
6. Async pending/error states

### **5.2 Storybook Contracts**
1. Render form states
   - default
   - invalid
   - disabled
   - pending
2. Prove interactions
   - typing
   - blur
   - submit
   - keyboard
3. Compliance surface
   - a11y
   - CSP
   - security-sensitive inputs

### **5.3 Production Checklist**
1. Typed controls
2. Server trust boundary
3. Accessible errors
4. Complete CVAs
5. Clear state ownership
6. Sensitive data minimized
7. Layered tests
