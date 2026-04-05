# Notification Panel Implementation Plan - Phase 7

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a notification side panel with floating toggle button, unread badge, severity filtering, and toast component for critical alerts.

**Architecture:** Floating button at bottom-right with slide-in panel (400px). Integrates with existing NotificationSignalStore for event data. Toast for critical alerts. All state managed via Angular Signals.

**Tech Stack:** Angular 19, Signals, Tailwind CSS 4.0, Storybook, Vitest

---

## File Structure

```
libs/ui/design-system/src/lib/design-system/
├── notification-panel/
│   ├── notification-toggle.component.ts    # Floating button + badge
│   ├── notification-toggle.component.html
│   ├── notification-toggle.component.scss
│   ├── notification-toggle.stories.ts
│   ├── notification-toggle.spec.ts
│   ├── notification-panel.component.ts     # Slide-in panel with list
│   ├── notification-panel.component.html
│   ├── notification-panel.component.scss
│   ├── notification-panel.stories.ts
│   ├── notification-panel.spec.ts
│   ├── notification-panel.service.ts       # State management
│   └── index.ts                             # Barrel export
└── toast/
    ├── toast.component.ts
    ├── toast.component.html
    ├── toast.component.scss
    ├── toast.stories.ts
    ├── toast.spec.ts
    ├── toast.service.ts
    └── index.ts
```

**Modify:**
- `libs/ui/design-system/src/index.ts` - Add exports for new components

---

## Task 1: NotificationPanelService

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.service.ts`
- Test: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.spec.ts` (create after implementation)

- [ ] **Step 1: Write the failing test**

```typescript
// notification-panel.spec.ts
import { TestBed } from '@angular/core/testing';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationPanelService', () => {
  let service: NotificationPanelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationPanelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have isOpen as signal', () => {
    expect(service.isOpen).toBeDefined();
    expect(typeof service.isOpen === 'function').toBe(true);
  });

  it('should have unreadCount as signal', () => {
    expect(service.unreadCount).toBeDefined();
    expect(typeof service.unreadCount === 'function').toBe(true);
  });

  it('should toggle panel visibility', () => {
    service.toggle();
    expect(service.isOpen()()).toBe(true);
    service.toggle();
    expect(service.isOpen()()).toBe(false);
  });

  it('should clear unread count', () => {
    service.markAllAsRead();
    expect(service.unreadCount()()).toBe(0);
  });

  it('should filter by severity', () => {
    service.setSeverityFilter('critical');
    expect(service.severityFilter()()).toBe('critical');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test design-system --testFile=notification-panel.spec.ts`
Expected: FAIL (service not defined)

- [ ] **Step 3: Write minimal implementation**

```typescript
// notification-panel.service.ts
import { Injectable, signal, computed } from '@angular/core';

export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

@Injectable({
  providedIn: 'root'
})
export class NotificationPanelService {
  private readonly _isOpen = signal(false);
  private readonly _unreadCount = signal(0);
  private readonly _severityFilter = signal<SeverityFilter>('all');
  private readonly _searchText = signal('');

  readonly isOpen = computed(() => this._isOpen);
  readonly unreadCount = computed(() => this._unreadCount);
  readonly severityFilter = computed(() => this._severityFilter);
  readonly searchText = computed(() => this._searchText);

  toggle(): void {
    this._isOpen.update(v => !v);
    if (this._isOpen()) {
      this.markAllAsRead();
    }
  }

  open(): void {
    this._isOpen.set(true);
    this.markAllAsRead();
  }

  close(): void {
    this._isOpen.set(false);
  }

  setUnreadCount(count: number): void {
    this._unreadCount.set(count);
  }

  decrementUnread(): void {
    this._unreadCount.update(v => Math.max(0, v - 1));
  }

  markAllAsRead(): void {
    this._unreadCount.set(0);
  }

  setSeverityFilter(filter: SeverityFilter): void {
    this._severityFilter.set(filter);
  }

  setSearchText(text: string): void {
    this._searchText.set(text);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test design-system --testFile=notification-panel.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/notification-panel/
git commit -m "feat(phase7): add NotificationPanelService with signal-based state management"
```

---

## Task 2: NotificationToggleComponent

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.ts`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.html`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.scss`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.stories.ts`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.spec.ts`
- Modify: `libs/ui/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// notification-toggle.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationToggleComponent } from './notification-toggle.component';
import { NotificationPanelService } from './notification-panel.service';

describe('NotificationToggleComponent', () => {
  let component: NotificationToggleComponent;
  let fixture: ComponentFixture<NotificationToggleComponent>;
  let service: NotificationPanelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationToggleComponent],
      providers: [NotificationPanelService]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationToggleComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(NotificationPanelService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show badge when unread > 0', () => {
    service.setUnreadCount(5);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.unread-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('5');
  });

  it('should hide badge when unread is 0', () => {
    service.setUnreadCount(0);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.unread-badge');
    expect(badge).toBeFalsy();
  });

  it('should toggle panel on click', () => {
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();
    expect(service.isOpen()()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test design-system --testFile=notification-toggle.spec.ts`
Expected: FAIL (component not defined)

- [ ] **Step 3: Write minimal implementation**

```typescript
// notification-toggle.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationPanelService } from './notification-panel.service';

/**
 * NotificationToggleComponent
 *
 * Floating button at bottom-right corner with unread badge.
 * Similar to iOS app notification icons.
 */
@Component({
  selector: 'tai-notification-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toggle.component.html',
  styleUrl: './notification-toggle.component.scss',
})
export class NotificationToggleComponent {
  private readonly panelService = inject(NotificationPanelService);

  readonly unreadCount = this.panelService.unreadCount;

  toggle(): void {
    this.panelService.toggle();
  }

  get displayCount(): number {
    const count = this.unreadCount()();
    return count > 9 ? 9 : count;
  }

  get showBadge(): boolean {
    return this.unreadCount()() > 0;
  }
}
```

```html
<!-- notification-toggle.component.html -->
<button 
  class="toggle-button"
  (click)="toggle()"
  aria-label="Toggle notifications"
>
  <!-- Bell icon (Lucide) -->
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
  
  @if (showBadge) {
    <span class="unread-badge">
      @if (unreadCount()() > 9) {
        9+
      } @else {
        {{ unreadCount()() }}
      }
    </span>
  }
</button>
```

```scss
/* notification-toggle.component.scss */
.toggle-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 50;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

.unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: #dc2626;
  color: white;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test design-system --testFile=notification-toggle.spec.ts`
Expected: PASS

- [ ] **Step 5: Write Storybook story**

```typescript
// notification-toggle.stories.ts
import type { Meta, StoryObj } from '@storybook/angular';
import { NotificationToggleComponent } from './notification-toggle.component';
import { NotificationPanelService } from './notification-panel.service';

const meta: Meta<NotificationToggleComponent> = {
  title: 'Design System/NotificationToggle',
  component: NotificationToggleComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<NotificationToggleComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = canvasElement;
    const button = canvas.querySelector('button');
    expect(button).toBeTruthy();
  },
};

export const WithUnread: Story = {
  decorators: [
    (story) => {
      const service = new NotificationPanelService();
      service.setUnreadCount(5);
      return story();
    },
  ],
};
```

- [ ] **Step 6: Export from index.ts**

Modify `libs/ui/design-system/src/index.ts`:
```typescript
export * from './lib/design-system/notification-panel/notification-toggle.component';
```

- [ ] **Step 7: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/notification-toggle.component.ts ...
git commit -m "feat(phase7): add NotificationToggleComponent with unread badge"
```

---

## Task 3: NotificationPanelComponent

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.component.ts`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.component.html`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.component.scss`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.stories.ts`
- Create: `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// notification-panel.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationPanelComponent } from './notification-panel.component';
import { NotificationPanelService } from './notification-panel.service';
import { NotificationSignalStore } from '../../../../../../apps/portal-web/src/app/store/notification-signal.store';

describe('NotificationPanelComponent', () => {
  let component: NotificationPanelComponent;
  let fixture: ComponentFixture<NotificationPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationPanelComponent],
      providers: [NotificationPanelService, NotificationSignalStore]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show panel when isOpen is true', () => {
    const service = TestBed.inject(NotificationPanelService);
    service.open();
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.notification-panel');
    expect(panel).toBeTruthy();
  });

  it('should filter by severity', () => {
    const service = TestBed.inject(NotificationPanelService);
    service.setSeverityFilter('critical');
    fixture.detectChanges();
    expect(component.severityFilter()()).toBe('critical');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test design-system --testFile=notification-panel.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// notification-panel.component.ts
import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationPanelService, SeverityFilter } from './notification-panel.service';
import { NotificationSignalStore } from '../../../../../../apps/portal-web/src/app/store/notification-signal.store';

export interface NotificationEvent {
  id: string;
  action: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  userId?: string;
  details?: string;
}

@Component({
  selector: 'tai-notification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
})
export class NotificationPanelComponent {
  private readonly panelService = inject(NotificationPanelService);
  private readonly notificationStore = inject(NotificationSignalStore);

  readonly isOpen = this.panelService.isOpen;
  readonly severityFilter = this.panelService.severityFilter;
  readonly searchText = this.panelService.searchText;

  // Get events from NotificationSignalStore
  readonly events = this.notificationStore.eventBuffer;

  // Filtered events based on severity and search
  readonly filteredEvents = () => {
    const allEvents = this.events();
    const filter = this.severityFilter()();
    const search = this.searchText()().toLowerCase();

    return allEvents.filter(event => {
      const matchesSeverity = filter === 'all' || event.action.toLowerCase().includes(filter);
      const matchesSearch = !search || 
        event.action.toLowerCase().includes(search) ||
        (event.details && event.details.toLowerCase().includes(search));
      return matchesSeverity && matchesSearch;
    });
  };

  setSeverity(filter: SeverityFilter): void {
    this.panelService.setSeverityFilter(filter);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.panelService.setSearchText(target.value);
  }

  close(): void {
    this.panelService.close();
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      default: return 'severity-info';
    }
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return date.toLocaleDateString();
  }
}
```

```html
<!-- notification-panel.component.html -->
@if (isOpen()()) {
  <div class="panel-overlay" (click)="close()"></div>
  <div class="notification-panel">
    <div class="panel-header">
      <h3>Notifications</h3>
      <button class="close-btn" (click)="close()" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    </div>

    <div class="search-box">
      <input 
        type="text" 
        placeholder="Search notifications..."
        [value]="searchText()()"
        (input)="onSearchChange($event)"
      />
    </div>

    <div class="filter-buttons">
      <button 
        [class.active]="severityFilter()() === 'all'"
        (click)="setSeverity('all')"
      >All</button>
      <button 
        [class.active]="severityFilter()() === 'critical'"
        (click)="setSeverity('critical')"
      >Critical</button>
      <button 
        [class.active]="severityFilter()() === 'warning'"
        (click)="setSeverity('warning')"
      >Warning</button>
      <button 
        [class.active]="severityFilter()() === 'info'"
        (click)="setSeverity('info')"
      >Info</button>
    </div>

    <div class="event-list">
      @for (event of filteredEvents(); track event.id) {
        <div class="event-item" [class]="getSeverityClass(event.action)">
          <div class="event-severity-bar"></div>
          <div class="event-content">
            <div class="event-action">{{ event.action }}</div>
            <div class="event-meta">
              <span class="event-time">{{ formatTime(event.timestamp) }}</span>
              @if (event.userId) {
                <span class="event-user">{{ event.userId }}</span>
              }
            </div>
          </div>
        </div>
      } @empty {
        <div class="empty-state">No notifications</div>
      }
    </div>
  </div>
}
```

```scss
/* notification-panel.component.scss */
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 99;
}

.notification-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;

  &:hover {
    color: #111;
  }
}

.search-box {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;

  input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;

    &:focus {
      outline: none;
      border-color: #3b82f6;
    }
  }
}

.filter-buttons {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;

  button {
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    border-radius: 16px;
    background: white;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #f3f4f6;
    }

    &.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }
  }
}

.event-list {
  flex: 1;
  overflow-y: auto;
}

.event-item {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s;

  &:hover {
    background: #f9fafb;
  }
}

.event-severity-bar {
  width: 4px;
  border-radius: 2px;
  margin-right: 12px;
  flex-shrink: 0;
}

.severity-critical .event-severity-bar {
  background: #dc2626;
}

.severity-warning .event-severity-bar {
  background: #f59e0b;
}

.severity-info .event-severity-bar,
.severity-LoginAnomaly .event-severity-bar {
  background: #3b82f6;
}

.event-content {
  flex: 1;
  min-width: 0;
}

.event-action {
  font-size: 14px;
  font-weight: 500;
  color: #111;
}

.event-meta {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #6b7280;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test design-system --testFile=notification-panel.spec.ts`
Expected: PASS

- [ ] **Step 5: Write Storybook story**

```typescript
// notification-panel.stories.ts
import type { Meta, StoryObj } from '@storybook/angular';
import { NotificationPanelComponent } from './notification-panel.component';

const meta: Meta<NotificationPanelComponent> = {
  title: 'Design System/NotificationPanel',
  component: NotificationPanelComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<NotificationPanelComponent>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = canvasElement;
    expect(canvas.querySelector('.notification-panel')).toBeTruthy();
  },
};
```

- [ ] **Step 6: Export from index.ts**

```typescript
export * from './lib/design-system/notification-panel/notification-panel.component';
```

- [ ] **Step 7: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/notification-panel/
git commit -m "feat(phase7): add NotificationPanelComponent with filters"
```

---

## Task 4: ToastService & ToastComponent

**Files:**
- Create: `libs/ui/design-system/src/lib/design-system/toast/toast.service.ts`
- Create: `libs/ui/design-system/src/lib/design-system/toast/toast.component.ts`
- Create: `libs/ui/design-system/src/lib/design-system/toast/toast.component.html`
- Create: `libs/ui/design-system/src/lib/design-system/toast/toast.component.scss`
- Create: `libs/ui/design-system/src/lib/design-system/toast/toast.stories.ts`
- Create: `libs/ui/design-system/src/lib/design-system/toast/toast.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// toast.spec.ts
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show toast', () => {
    service.show('Test message', 'critical');
    expect(service.toast()()).toBeTruthy();
  });

  it('should hide toast', () => {
    service.show('Test message', 'critical');
    service.hide();
    expect(service.toast()()).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test design-system --testFile=toast.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// toast.service.ts
import { Injectable, signal, computed } from '@angular/core';

export interface Toast {
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly _toast = signal<Toast | null>(null);

  readonly toast = computed(() => this._toast);

  show(message: string, severity: 'critical' | 'warning' | 'info' = 'info'): void {
    this._toast.set({
      message,
      severity,
      timestamp: Date.now()
    });
  }

  hide(): void {
    this._toast.set(null);
  }
}
```

```typescript
// toast.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'tai-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);

  readonly toast = this.toastService.toast;

  dismiss(): void {
    this.toastService.hide();
  }

  getSeverityClass(): string {
    const t = this.toast()();
    if (!t) return '';
    return `toast-${t.severity}`;
  }
}
```

```html
<!-- toast.component.html -->
@if (toast()(); as t) {
  <div class="toast" [class]="getSeverityClass()">
    <div class="toast-content">
      <span class="toast-message">{{ t.message }}</span>
    </div>
    <button class="toast-close" (click)="dismiss()" aria-label="Dismiss">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
      </svg>
    </button>
  </div>
}
```

```scss
/* toast.component.scss */
.toast {
  position: fixed;
  top: 80px;
  right: 24px;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease-out;
  z-index: 200;
  max-width: 400px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast-critical {
  background: #fef2f2;
  border: 1px solid #dc2626;
  color: #991b1b;
}

.toast-warning {
  background: #fffbeb;
  border: 1px solid #f59e0b;
  color: #92400e;
}

.toast-info {
  background: #eff6ff;
  border: 1px solid #3b82f6;
  color: #1e40af;
}

.toast-content {
  flex: 1;
}

.toast-message {
  font-size: 14px;
}

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test design-system --testFile=toast.spec.ts`
Expected: PASS

- [ ] **Step 5: Write Storybook story**

```typescript
// toast.stories.ts
import type { Meta, StoryObj } from '@storybook/angular';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

const meta: Meta<ToastComponent> = {
  title: 'Design System/Toast',
  component: ToastComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ToastComponent>;

export const Critical: Story = {
  decorators: [
    (story) => {
      const service = new ToastService();
      service.show('Security alert: Suspicious login detected', 'critical');
      return story();
    },
  ],
};
```

- [ ] **Step 6: Export from index.ts**

```typescript
export * from './lib/design-system/toast/toast.service';
export * from './lib/design-system/toast/toast.component';
```

- [ ] **Step 7: Commit**

```bash
git add libs/ui/design-system/src/lib/design-system/toast/
git commit -m "feat(phase7): add ToastService and ToastComponent"
```

---

## Task 5: Integration - Connect to RealTimeService

**Files:**
- Modify: `apps/portal-web/src/app/real-time.service.ts`
- Modify: `apps/portal-web/src/app/app.component.ts` (or main layout)

- [ ] **Step 1: Update RealTimeService to show toast on critical events**

```typescript
// Add to real-time.service.ts after receiving event:
import { ToastService } from '@tai/design-system';

constructor(
  // ... existing dependencies
  private readonly toastService: ToastService,
) {}

private handleSecurityEvent(event: SecurityEventPayload): void {
  // Existing: add to notification store
  this.notificationStore.addEvent(fullEvent);

  // New: show toast for critical events
  if (event.EventType === 'LoginAnomaly' || event.EventType === 'PrivilegeChange') {
    this.toastService.show(
      `${event.EventType}: ${event.Reason || 'Security alert'}`,
      'critical'
    );
  }
}
```

- [ ] **Step 2: Add NotificationToggle and Toast to app layout**

In `app.component.ts`:
```typescript
import { NotificationToggleComponent } from '@tai/design-system';
import { ToastComponent } from '@tai/design-system';

@Component({
  selector: 'tai-app-root',
  standalone: true,
  imports: [/* ... existing */, NotificationToggleComponent, ToastComponent],
  template: `
    <!-- Existing content -->
    <tai-toast></tai-toast>
    <tai-notification-toggle></tai-notification-toggle>
  `
})
export class AppComponent {}
```

- [ ] **Step 3: Test integration**

- [ ] **Step 4: Commit**

---

## Task 6: Phase Completion

- [ ] **Step 1: Run lint**

```bash
npx nx run-many -t lint --projects=design-system
```

- [ ] **Step 2: Run tests**

```bash
npx nx test design-system
```

- [ ] **Step 3: Update plan.md checkpoint**

- [ ] **Step 4: Commit**

```bash
git add conductor/tracks/real_time_security_notifications_20260329/plan.md
git commit -m "conductor(plan): mark Phase 7 complete"
```

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Floating toggle button at bottom-right | Task 2 |
| Unread badge (iPhone style) | Task 2 |
| 400px side panel | Task 3 |
| Slide-in animation | Task 3 |
| Color-coded by severity | Task 3 |
| Filter by severity buttons | Task 3 |
| Search box filter | Task 3 |
| Latest at bottom | Task 3 (already in design) |
| Toast for critical | Task 4 |
| Persistent until clicked | Task 4 |
| Storybook tests | Tasks 2,3,4 |

**Plan complete and saved to `docs/superpowers/plans/2026-04-05-notification-panel-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?