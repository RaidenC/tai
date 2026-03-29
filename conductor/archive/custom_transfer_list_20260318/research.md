# Research: Custom Transfer List Component

## 1. Existing Infrastructure Analysis

### 1.1 UI Design System Library
- **Path:** `libs/ui/design-system/src/lib`
- **Technology:** Angular 21, Tailwind CSS 4.0, Signals.
- **Patterns:**
    - Use of `ChangeDetectionStrategy.OnPush`.
    - Signal-based inputs and outputs.
    - Consistent padding and density patterns (`compact` vs `comfortable`).

### 1.2 CDK Dependencies
- Need to verify if `@angular/cdk` is installed and which version.
- Specifically need:
    - `@angular/cdk/drag-drop`
    - `@angular/cdk/listbox`
    - `@angular/cdk/scrolling`
    - `@angular/cdk/a11y`

### 1.3 Feature Integration (User Management)
- **Path:** `libs/features/user-management`
- **Context:** Edit User page.
- **Form Usage:** Reactive Forms.

## 2. Technical Spikes & Feasibility

### 2.1 Drag-and-Drop with Virtual Scroll
- **Challenge:** `cdkDropList` usually requires items to be in the DOM. Virtual scrolling removes off-screen items.
- **Solution Strategy:** Use a custom `ScrollStrategy` or a specialized wrapper that maintains a "ghost" or "proxy" list for the CDK DND logic while the virtual scroll handles the rendering. Alternatively, ensure the `cdkDropList` is attached to the viewport's content wrapper.

### 2.2 ControlValueAccessor (CVA)
- The component needs to manage a list of `assignedIds` (or full objects) and synchronize them with the form control.
- `writeValue` will receive the initial set of assigned items.
- `registerOnChange` will provide the callback to notify the form of updates.

### 2.3 Performance (Signals & Memoization)
- `computed()` will be used to filter both "Available" and "Assigned" lists based on search terms.
- `track` property in `@for` is mandatory for DOM recycling performance.

## 3. Dependency Check
I will check `package.json` to ensure all required CDK modules are available.

## 4. Component API Design (Proposed)
```typescript
export interface TransferItem {
  id: string | number;
  [key: string]: any;
}

@Component({
  selector: 'tai-transfer-list',
  // ...
})
export class TransferListComponent<T extends TransferItem> implements ControlValueAccessor {
  // Inputs
  items = input.required<T[]>();
  displayKey = input<keyof T>('name' as keyof T);
  trackKey = input<keyof T>('id' as keyof T);
  density = input<'compact' | 'comfortable'>('comfortable');
  
  // Signals for internal state
  searchTermAvailable = signal('');
  searchTermAssigned = signal('');
  
  // Computed lists
  filteredAvailable = computed(() => ...);
  filteredAssigned = computed(() => ...);
  
  // ... CVA implementation
}
```

## 5. Security & Accessibility
- No `[innerHTML]`.
- ARIA listbox roles.
- Keyboard navigation (Up/Down for selection, Enter/Space for transfer).
- `LiveAnnouncer` for screen reader feedback on transfers.