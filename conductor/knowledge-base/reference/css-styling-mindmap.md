---
markmap:
  initialExpandLevel: 4
  colorFreezeLevel: 3
  spacingVertical: 12
---

# **CSS, Styling & Tailwind**

## **1. Cascade & Specificity**

### **1.1 The Cascade**
1. Origin → Layer → Specificity → Order
   - User-agent < User < Author < Author !important
2. `!important` is a layering escape hatch, not a hammer
3. Last declaration wins on tie

### **1.2 Specificity Tuple**
1. `(inline, id, class+pseudo+attr, element)`
   - Inline `style=""` = (1,0,0,0)
   - `#id` = (0,1,0,0)
   - `.class` = (0,0,1,0)
2. `:where()` = always 0 specificity
3. `:is()` = highest of args; `:not()` = same

### **1.3 Cascade Layers (`@layer`)**
1. `@layer reset, base, components, utilities;` declared once
2. Later layers override earlier (regardless of specificity)
3. Unlayered styles beat ALL layered styles
4. `!important` INVERTS layer order (gotcha)
5. Tailwind v4 ships native `@layer theme, base, components, utilities;`

### **1.4 Modern Selectors**
1. `:has(child)` — parent selector (Baseline 2023)
   - `tr:has(input:checked)` — pure CSS row selection
   - `form:has(:invalid)` — form-level validation state
2. `:is()` / `:where()` — group selectors with/without specificity
3. `:focus-visible` — keyboard focus only (not mouse click)
4. Combinators: `>` direct child, `+` adjacent, `~` later sibling

## **2. Box Model & Layout Engine**

### **2.1 Box Model & `box-sizing`**
1. content → padding → border → margin (concentric)
2. `box-sizing: border-box` makes width = entire visible box
3. Always `*, *::before, *::after { box-sizing: border-box }`
4. Margin is OUTSIDE the box (use `gap` in flex/grid)

### **2.2 Block Formatting Context (BFC)**
1. Trapping margins, containing floats, preventing wrap
2. Modern trigger: `display: flow-root`
3. Side-effect triggers: `overflow: hidden`, `flex`, `grid`, `position: absolute`
4. Three classic bugs solved by BFC

### **2.3 Stacking Contexts & `z-index`**
1. `z-index: 9999` only beats siblings in the same stacking context
2. Triggers: position+z-index, opacity<1, transform, filter, isolation
3. **`isolation: isolate`** = the modern, intentional trigger
4. Tailwind: `isolate` utility

### **2.4 Containment**
1. `contain: layout` / `paint` / `strict`
2. `content-visibility: auto` defers offscreen render
3. Pair with `contain-intrinsic-size` for scroll accuracy
4. Use on long lists (audit logs, chat history)

## **3. Layout Systems**

### **3.1 Flexbox (1-D)**
1. `flex-direction`, `justify-content`, `align-items`, `gap`
2. `flex: 1 1 auto` shorthand (grow shrink basis)
3. Use for: toolbars, nav bars, form rows, single-axis layouts
4. Wrapping is per-line; can't align across lines

### **3.2 Grid (2-D)**
1. `grid-template-columns/rows/areas`, `gap`
2. `repeat(auto-fit, minmax(280px, 1fr))` — responsive cards, no media queries
3. `subgrid` (2023) — child inherits parent tracks
4. Use for: app shells, card galleries, data tables

### **3.3 Positioning**
1. `static` / `relative` / `absolute` / `fixed` / `sticky`
2. `position: sticky` requires scroll-container ancestor + `top`/`bottom` value
3. `position: fixed` inside `transform`ed ancestor anchors to ancestor (not viewport)
4. Stacking context implications

### **3.4 Logical Properties**
1. `margin-inline-start` instead of `margin-left`
2. Auto-mirrors for RTL/LTR
3. Tailwind v4: `ms-2`, `pe-4`, etc.

## **4. Sizing, Units & Responsive**

### **4.1 Units**
1. `rem` for spacing/typography (respects user font-size)
2. `dvh`/`dvw` (dynamic viewport) instead of `vh`/`vw` on mobile
3. `ch` for line length (`max-width: 65ch`)
4. `fr` only in grid (fractional)
5. `%` of parent dimension

### **4.2 Fluid Sizing**
1. `clamp(min, preferred, max)` — fluid typography in one line
2. `min(100% - 2rem, 64rem)` — width with gutter and cap
3. `max(2.75rem, 44px)` — touch target floor

### **4.3 Container vs Media Queries**
1. Media query — viewport-based
2. Container query — parent-container-based
   - `container-type: inline-size; container-name: card`
   - `@container card (min-width: 400px) { ... }`
3. Tailwind v4: `@container` + `@md:grid-cols-2`
4. Use for: components in unknown layout slots

## **5. Modern CSS (2024–2026)**

### **5.1 Custom Properties (Theming)**
1. `--name` runtime variables; cascading; JS-readable
2. Three-tier hierarchy: primitive → semantic → component
3. Theme via attribute: `[data-theme="dark"]` or `[data-tenant="acme"]`
4. CSP-clean (no inline styles needed for theming)

### **5.2 `:has()` Parent Selector**
1. Form validation: `form:has(:invalid)`
2. Stateful styling: `tr:has(:checked)`
3. Layout adapts: `.layout:has(> .sidebar)`
4. Removes JS-driven class toggling
5. Engine cost: walks descendants; bounded modern engines

### **5.3 OKLCH & `color-mix()`**
1. OKLCH = perceptually uniform (lightness, chroma, hue)
2. Equal lightness = equal apparent brightness (RGB lies)
3. `color-mix(in oklch, blue 60%, red)` for derivatives
4. Tailwind v4 ships OKLCH palette
5. Walk lightness for color scales

### **5.4 Native CSS Nesting**
1. No more SCSS just for nesting (Baseline 2023)
2. `&` required at start of nested selectors
3. Keep nesting 2 levels max (specificity inflation)

### **5.5 View Transitions API**
1. `document.startViewTransition(() => updateDOM())`
2. `view-transition-name` tags for morphed elements
3. Wrap in `prefers-reduced-motion` check
4. Browser support: Chrome stable, others catching up

## **6. Tailwind CSS**

### **6.1 Utility-First Philosophy**
1. Single-purpose utility classes composed in HTML
2. No naming overhead, no specificity wars, no dead CSS
3. JIT generates only used classes
4. "Class soup" is a perception, not a real cost

### **6.2 Tailwind v4 (CSS-First)**
1. `@theme` block in CSS replaces `tailwind.config.js`
2. OKLCH colors by default
3. Lightning CSS engine (~100ms incremental)
4. Native `@layer theme, base, components, utilities;`

### **6.3 Variants & Arbitrary Values**
1. `hover:`, `focus:`, `dark:`, `md:`, `data-[state=open]:`
2. `peer-`, `group-`, `motion-reduce:`, `aria-disabled:`
3. Arbitrary: `grid-cols-[repeat(auto-fit,minmax(280px,1fr))]`
4. Dynamic class names BREAK JIT — use lookup maps

### **6.4 `@apply` — Use Sparingly**
1. OK: third-party component overrides, print styles
2. NOT OK: components you control (defeats utility-first)
3. Tailwind author: "Probably misusing if you're using @apply"

### **6.5 Tailwind & Strict CSP**
1. Build-time CSS from `'self'` — CSP-friendly by default
2. No runtime `<style>` injection, no inline `style=`
3. Why Material struggles: CDK Overlay injects positioning inline
4. Theme switch via class swap, not inline style

## **7. Angular Styling**

### **7.1 View Encapsulation**
1. `Emulated` (default) — attribute selectors `[_ngcontent-c0]`
2. `ShadowDom` — true Shadow DOM isolation
3. `None` — global leakage (legacy migrations only)

### **7.2 `:host` & Death of `::ng-deep`**
1. `:host { display: block }` — style component element itself
2. `:host(.featured)` — host with class
3. `:host-context(.dark)` — ancestor-based
4. `::ng-deep` DEPRECATED → use CSS custom properties for parent-child theming

### **7.3 The Hybrid Stack**
1. Tailwind utilities in template (spacing, color, layout)
2. Component SCSS for `::before`, animations, complex pseudo
3. Global `styles.css` for tokens, resets, Tailwind import
4. Discipline: don't duplicate "padding here AND there"

## **8. CSS Architecture**

### **8.1 BEM, OOCSS, SMACSS**
1. Naming conventions to flatten specificity (pre-2020 era)
2. Tailwind utilities solve same problems with less ceremony
3. Maintain legacy BEM; choose utilities for new

### **8.2 CSS Modules / Scoped Styles**
1. Hashed class names per file
2. Vue `<style scoped>` / Angular `Emulated` are equivalents
3. Pair with Tailwind for layout/spacing utilities

### **8.3 CSS-in-JS**
1. Runtime (styled-components) — DYING (CSP, perf, SSR pain)
2. Compile-time (Vanilla Extract, Pigment) — surviving path
3. 2026: prefer Tailwind for new React work

### **8.4 Utility-First (Why It Won)**
1. JIT killed the bundle-size objection
2. Custom properties killed the design-token objection
3. Component frameworks killed the "where's the CSS" objection
4. Refactoring locality, no naming overhead, no specificity wars

### **8.5 Design Tokens**
1. Three tiers: primitive → semantic → component
2. Style Dictionary for multi-platform emit (web/iOS/Android)
3. Tokens Studio for Figma-native authoring
4. Tailwind v4 `@theme` IS your token config

## **9. Performance**

### **9.1 Critical CSS**
1. Inline above-the-fold; lazy-load rest
2. Tools: critters (Angular), critical npm
3. Render-blocking is the bottleneck for first paint

### **9.2 GPU-Accelerated Animation**
1. Animate `transform` and `opacity` only
2. `will-change: transform` hints layer promotion
3. Don't animate `width`, `top`, `left` (full layout)
4. `will-change` overuse blows GPU memory

### **9.3 Layout Thrash**
1. Read-write-read-write loop forces multiple layouts
2. Fix: batch reads, then batch writes
3. Use `requestAnimationFrame` for animations
4. Chrome DevTools → Performance → look for "Layout"

### **9.4 Specificity Wars**
1. Cascade layers eliminate the entire class of bug
2. `:where()` for design-system base styles (0 specificity)
3. Strict no-`!important` policy in modern code
4. `isolation: isolate` for stacking contexts

## **10. Accessibility**

### **10.1 Focus Indicators**
1. Don't `outline: none` without replacement
2. `:focus-visible` for keyboard-only focus rings
3. Replace with `outline: 2px solid var(--color-focus)` + `outline-offset: 2px`

### **10.2 User Preferences**
1. `@media (prefers-reduced-motion: reduce)` — kill animations
2. `@media (prefers-color-scheme: dark)` — auto dark mode
3. Tailwind: `motion-reduce:`, `dark:` variants

### **10.3 Contrast & Touch Targets**
1. WCAG 2.2 AA: 4.5:1 normal text, 3:1 large
2. Touch targets minimum 44×44 CSS pixels
3. Hit area > visual size via padding or pseudo-elements
4. Tools: axe-core, Lighthouse a11y audit

## **11. tai-portal Real Examples**

### **11.1 Tailwind v4 Stack**
1. `@layer theme, base, components, utilities;`
2. OKLCH color tokens via `@theme`
3. CSS-first config (no `tailwind.config.js`)
4. Components: utilities in template + SCSS for `:host` and complex patterns

### **11.2 Custom Components vs Material**
1. `secure-input`, `datatable`, `transfer-list` built custom
2. Reason: strict CSP — Material CDK Overlay injects inline styles
3. Tailwind utilities + custom SCSS = full control + CSP-clean

### **11.3 Multi-Tenant Theming Pattern**
1. `[data-tenant="acme"]` overrides tier-1 tokens on `:root`
2. Components consume tier-3 component tokens via `var()`
3. Brand refresh = one OKLCH value change
4. CSP-clean, JS-free at render

## **12. Interview Readiness**

### **12.1 L1 Junior**
1. Box model + `box-sizing`
2. Block vs inline vs inline-block
3. Specificity tuple
4. Position absolute vs relative

### **12.2 L2 Mid-Level**
1. Flexbox vs Grid (1-D vs 2-D)
2. Stacking contexts and `z-index` failures
3. CSS custom properties vs Sass variables
4. `:has()` use cases
5. Container queries vs media queries

### **12.3 L3 Senior**
1. Why Tailwind over Angular Material under strict CSP
2. Multi-tenant theming with three-tier tokens
3. Specificity-war fix using cascade layers
4. `::before`/`::after` techniques + Tailwind variants

### **12.4 Staff**
1. Design system architecture for 100-tenant SaaS
2. Sass+CSS → Tailwind migration plan
3. Performance audit and optimization strategy
4. Accessibility-first design system governance
