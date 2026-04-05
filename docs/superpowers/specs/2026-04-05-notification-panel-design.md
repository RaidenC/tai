# Notification Side Panel Design - Phase 7

## Overview

Real-time notification panel that displays security events from `NotificationSignalStore` with severity-based color coding, filtering, and unread badge tracking.

## Components

### 1. Floating Toggle Button
- Fixed position: bottom-right corner (24px from edges)
- Icon: Bell icon (using existing icon library)
- Size: 48x48px
- Background: Primary theme color
- Shadow: Subtle drop shadow for elevation

### 2. Unread Badge
- Position: Top-right corner of toggle button
- Shape: Circular, red (#DC2626)
- Content: Number of unread events (max display: "9+" for 10+)
- Visibility: Only shown when unreadCount > 0

### 3. Side Panel
- Width: 400px fixed
- Position: Slides in from right edge
- Animation: 300ms slide transition
- Background: White/Dark theme dependent
- Z-index: Above other content

### 4. Toast Component
- Position: Top-right corner, below any app header
- Behavior: Persistent until clicked or dismiss button pressed
- Purpose: Immediate attention for critical events

## Panel Content Specification

### Event List
- Source: `NotificationSignalStore.eventBuffer()` (max 50 events)
- Sort order: Oldest at top, latest at **bottom**
- Each event shows:
  - Severity indicator (color-coded left border)
  - Action text
  - Timestamp (relative time: "2 min ago")
  - User ID (if available)

### Severity Color Coding
- 🔴 **Critical** - Red border (#DC2626)
- 🟡 **Warning** - Yellow border (#F59E0B)
- 🔵 **Info** - Blue border (#3B82F6)

### Filters
- **Severity buttons**: [All] [Critical] [Warning] [Info]
- **Search box**: Text input that filters by action/details text

## User Interactions

1. **Toggle Panel**: Click bell icon to show/hide panel
2. **Mark as Read**: 
   - Opening panel marks all visible events as read
   - Clicking individual event marks that event as read
3. **Clear Badge**: Unread count clears when all events viewed
4. **Toast Dismiss**: Click toast or X button to dismiss

## State Management

```typescript
interface NotificationPanelState {
  isOpen: boolean;           // Panel visibility
  unreadCount: number;      // Badge count
  selectedSeverity: 'all' | 'critical' | 'warning' | 'info';
  searchText: string;
}
```

## Technical Implementation

### New Files
- `libs/ui/design-system/src/lib/design-system/notification-panel/notification-toggle.component.ts`
- `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.component.ts`
- `libs/ui/design-system/src/lib/design-system/notification-panel/notification-panel.service.ts`
- `libs/ui/design-system/src/lib/design-system/toast/toast.component.ts`
- `libs/ui/design-system/src/lib/design-system/toast/toast.service.ts`

### Dependencies
- Angular Signals for state
- Existing `NotificationSignalStore` for event data
- Lucide icons (already in project)
- Tailwind CSS for styling

### Testing
- Storybook with Interaction Tests for both components
- Vitest unit tests for service logic and state transitions

## Acceptance Criteria

1. ✅ Floating button appears at bottom-right
2. ✅ Badge shows unread count (red circle)
3. ✅ Panel slides in/out on toggle click
4. ✅ Events display with severity color coding
5. ✅ Latest events appear at bottom
6. ✅ Filter buttons filter by severity
7. ✅ Search box filters by text
8. ✅ Clicking panel/event marks as read
9. ✅ Badge clears when all read
10. ✅ Toast appears for critical events
11. ✅ Storybook tests pass with play functions