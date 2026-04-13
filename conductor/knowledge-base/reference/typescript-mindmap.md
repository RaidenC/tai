---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **TypeScript**

## **1. Type System Foundations**
### **1.1 Structural Typing**
1. Shape-based compatibility, not name-based
   - Two types with same shape are interchangeable
   - Opposite of C#/Java nominal typing
2. Excess property checks only on object literals
   - Assigning through variables bypasses checks
3. Branded types simulate nominal typing
   - `type UserId = string & { __brand: 'UserId' }`

### **1.2 Union Types & Discriminated Unions**
1. Union: `A | B` — value is one of several types
   - Requires narrowing before property access
2. Discriminated union: common literal discriminant
   - Makes impossible states unrepresentable
3. tai-portal pattern: string literal unions for status
   - `'Idle' | 'Loading' | 'Success' | 'Error'`
   - Paired with separate signals for associated data

### **1.3 Type Narrowing & Guards**
1. Built-in: `typeof`, `instanceof`, `in`, equality
   - Compiler auto-narrows in control flow branches
2. Custom type guard: `x is SomeType` return type
   - Compiler trusts you — wrong guard = silent bugs
3. `asserts x is T` for assertion-style throwing guards
   - Narrows type for entire remaining scope

### **1.4 `interface` vs `type`**
1. `interface`: object shapes, extends, declaration merging
   - Slightly faster for compiler (named identity)
2. `type`: unions, intersections, mapped/conditional types
   - Cannot merge (redeclaration = error)
3. tai-portal rule: interface for models, type for unions

## **2. Generics & Type-Level Programming**
### **2.1 Generics**
1. Parameterized types: `Array<T>`, `Signal<T>`
   - Preserve caller's type through the function
2. Rule: if `T` appears < 2 times, you don't need it
   - Over-genericizing adds complexity without benefit
3. tai-portal: `TableColumnDef<T>`, `PaginatedList<T>`

### **2.2 Generic Constraints**
1. `extends` constrains T to a minimum shape
   - `<T extends { id: string }>` — access `.id` safely
2. `extends keyof` for type-safe property access
   - `<K extends keyof T>` — only valid keys accepted
3. Start with minimum constraint needed
   - Over-constraining couples to specific domain types

### **2.3 Utility Types**
1. `Partial<T>` / `Required<T>` — toggle optional
   - Partial for updates, Required for form submission
2. `Pick<T, K>` / `Omit<T, K>` — derive DTO types
   - Keep in sync when base type changes
3. `Record<K, V>` — typed dictionaries
   - tai-portal: DPoP payload typed as `Record<string, string | number>`
4. `ReturnType<T>` / `Parameters<T>` — extract from functions
   - Derive store state type from factory function

### **2.4 Mapped & Conditional Types**
1. Mapped: `{ [K in keyof T]: ... }` — transform all props
   - Foundation of Partial, Required, Readonly
2. Conditional: `T extends U ? X : Y` — type-level if/else
   - `infer` keyword extracts types from structures
3. Turing-complete but keep it simple
   - Deep recursion hits ~50 level compiler limit

## **3. Modern TypeScript (5.x)**
### **3.1 `satisfies` Operator**
1. Validates shape without widening type
   - Get type-checking AND literal type preservation
2. Perfect for config objects, route maps
   - `const cfg = { ... } satisfies Record<string, X>`
3. Zero runtime cost — purely compile-time

### **3.2 `as const` & `const` Type Parameters**
1. `as const` narrows to literal types + readonly
   - Derive union types from arrays: `typeof X[number]`
2. `const` type parameter: auto `as const` for callers
   - Library functions get narrow types by default
3. Everything becomes readonly — may need `Readonly<T>` in signatures

### **3.3 Template Literal Types**
1. String pattern types: `` `on${Capitalize<E>}` ``
   - Auto-generate event handler names, API routes
2. Intrinsic: `Uppercase`, `Lowercase`, `Capitalize`
3. Beware combinatorial explosion with large unions

### **3.4 Enums vs Unions vs `as const`**
1. `enum`: runtime object + reverse map, API compat
   - tai-portal `RiskLevel` for .NET numeric codes
2. String literal union: zero runtime, type-only
   - tai-portal `PrivilegesStatus` for store state
3. `as const` object: runtime access + literal types
   - 2026 recommended default for new code
