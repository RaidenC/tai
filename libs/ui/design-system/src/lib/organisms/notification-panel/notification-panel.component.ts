import { A11yModule } from '@angular/cdk/a11y';
import { afterNextRender, ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Injector, Input, OnChanges, OnDestroy, Output, runInInjectionContext, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationPanelService, SeverityFilter } from './notification-panel.service';
import { NotificationPanelItem } from './notification-panel.types';
import type { NotificationPanelConnectionState } from './notification-panel.types';

type FocusTarget =
  | { kind: 'item'; id: string; index: number }
  | { kind: 'close-button'; id: null; index: -1 };

@Component({
  selector: 'tai-notification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent implements OnChanges, OnDestroy {
  private readonly panelService = inject(NotificationPanelService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);

  @Input() notifications: NotificationPanelItem[] = [];
  @Input() isLoading = false;
  @Input() hasHydrated = false;
  @Input() error: string | null = null;
  @Input() connectionState: NotificationPanelConnectionState = 'connected';
  @Input() isRetryThrottled = false;
  @Input() recoveryNotice: string | null = null;
  @Output() retry = new EventEmitter<void>();
  @Output() markRead = new EventEmitter<string>();
  @Output() markAllRead = new EventEmitter<void>();
  @Output() acknowledge = new EventEmitter<string>();

  readonly isOpen = this.panelService.isOpen;
  readonly severityFilter = this.panelService.severityFilter;
  readonly searchText = this.panelService.searchText;

  // Skeleton timing state
  private skeletonDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private skeletonMinDisplayTimer: ReturnType<typeof setTimeout> | null = null;
  private skeletonShownAt = 0;
  protected showInitialSkeletonState = false;

  // Search-to-empty tracking
  private wasSearchMatchBeforeHydrate = false;
  private hydrateSearchText: string | null = null;

  // Focus management
  private focusedNotificationId: string | null = null;

  focusedNotificationIdForTest(): string | null {
    return this.focusedNotificationId;
  }

  focusNotificationForTest(id: string): void {
    this.focusedNotificationId = id;
  }

  readonly firstVisibleNotificationId = (): string | null => this.filteredNotifications()[0]?.id ?? null;
  readonly rovingNotificationId = (): string | null =>
    this.focusedNotificationId ?? this.firstVisibleNotificationId();

  // Computed display helpers
  readonly showInitialSkeleton = (): boolean => this.showInitialSkeletonState;
  readonly isReconnectSyncing = (): boolean =>
    this.isLoading && this.hasHydrated && this.connectionState === 'reconnecting';
  readonly hasVisibleNotifications = (): boolean => this.filteredNotifications().length > 0;
  readonly showConnectionBanner = (): boolean =>
    !this.error &&
    !this.recoveryNotice &&
    !this.isReconnectSyncing() &&
    (this.connectionState !== 'connected' || this.hasVisibleNotifications());
  readonly showSearchToEmpty = (): boolean =>
    !this.isLoading &&
    !!this.searchText()() &&
    this.wasSearchMatchBeforeHydrate &&
    this.hydrateSearchText === this.searchText()() &&
    this.filteredNotifications().length === 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isLoading']) {
      if (this.isLoading) {
        this.captureSearchStateBeforeHydrate();
        this.startSkeletonDelay();
      } else {
        this.finishSkeleton();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearSkeletonTimers();
  }

  private captureSearchStateBeforeHydrate(): void {
    const search = this.searchText()();
    this.hydrateSearchText = search || null;
    this.wasSearchMatchBeforeHydrate = !!search && this.filteredNotifications().length > 0;
  }

  private startSkeletonDelay(): void {
    this.clearSkeletonTimers();
    if (this.hasHydrated) {
      this.showInitialSkeletonState = false;
      return;
    }

    this.skeletonDelayTimer = setTimeout(() => {
      this.showInitialSkeletonState = true;
      this.skeletonShownAt = Date.now();
      this.cdr.markForCheck();
    }, 300);
  }

  private finishSkeleton(): void {
    if (!this.showInitialSkeletonState) {
      this.clearSkeletonTimers();
      return;
    }

    const remaining = Math.max(300 - (Date.now() - this.skeletonShownAt), 0);
    this.skeletonMinDisplayTimer = setTimeout(() => {
      this.showInitialSkeletonState = false;
      this.clearSkeletonTimers();
      this.cdr.markForCheck();
    }, remaining);
  }

  private clearSkeletonTimers(): void {
    if (this.skeletonDelayTimer) {
      clearTimeout(this.skeletonDelayTimer);
      this.skeletonDelayTimer = null;
    }
    if (this.skeletonMinDisplayTimer) {
      clearTimeout(this.skeletonMinDisplayTimer);
      this.skeletonMinDisplayTimer = null;
    }
  }

  onRetry(): void {
    if (this.isLoading || this.isRetryThrottled) {
      return;
    }
    this.retry.emit();
  }

  readonly hasUnread = (): boolean => this.notifications.some(notification => notification.readAt === null);

  onMarkRead(notification: NotificationPanelItem): void {
    if (notification.readAt) {
      return;
    }
    this.markRead.emit(notification.id);
  }

  onMarkAllRead(): void {
    if (!this.hasUnread()) {
      return;
    }

    const previousId = this.focusedNotificationId;
    const previousIndex = this.filteredNotifications().findIndex(item => item.id === previousId);
    this.markAllRead.emit();

    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        const target = this.resolveFocusAfterMutation(previousId, previousIndex);
        this.focusedNotificationId = target.id;
        this.focusTarget(target);
      });
    });
  }

  onAcknowledge(notification: NotificationPanelItem): void {
    if (notification.severity !== 'critical' || notification.acknowledgedAt) {
      return;
    }
    this.acknowledge.emit(notification.id);
  }

  // Filtered notifications based on severity and search
  readonly filteredNotifications = (): NotificationPanelItem[] => {
    const allNotifications = this.notifications || [];
    const filter = this.severityFilter()();
    const search = this.searchText()().toLowerCase();

    return allNotifications
      .filter(notification => {
        const matchesSeverity = filter === 'all' || notification.severity === filter;
        const matchesSearch = !search ||
          notification.title.toLowerCase().includes(search) ||
          (notification.summary && notification.summary.toLowerCase().includes(search)) ||
          notification.actor.toLowerCase().includes(search);
        return matchesSeverity && matchesSearch;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }

    if (this.searchText()()) {
      event.stopPropagation();
      this.panelService.setSearchText('');
      return;
    }

    this.close();
  }

  onFilterClick(filter: SeverityFilter): void {
    const previousId = this.focusedNotificationId;
    const previousIndex = this.filteredNotifications().findIndex(item => item.id === previousId);
    this.panelService.setSeverityFilter(filter);
    this.focusedNotificationId = this.resolveFocusAfterMutation(previousId, previousIndex).id;
  }

  onListKeydown(event: KeyboardEvent): void {
    const items = this.filteredNotifications();
    if (items.length === 0) {
      return;
    }

    const currentIndex = Math.max(0, items.findIndex(item => item.id === this.focusedNotificationId));
    const nextIndex =
      event.key === 'ArrowDown' ? (currentIndex + 1) % items.length :
      event.key === 'ArrowUp' ? (currentIndex - 1 + items.length) % items.length :
      event.key === 'Home' ? 0 :
      event.key === 'End' ? items.length - 1 :
      -1;

    if (nextIndex >= 0) {
      event.preventDefault();
      this.focusedNotificationId = items[nextIndex].id;
      runInInjectionContext(this.injector, () => {
        afterNextRender(() => {
          document.querySelector<HTMLElement>(`[data-notification-id="${items[nextIndex].id}"]`)?.focus();
        });
      });
    }
  }

  private resolveFocusAfterMutation(previousId: string | null, previousIndex: number): FocusTarget {
    const visibleItems = this.filteredNotifications();
    if (visibleItems.length === 0) {
      return { kind: 'close-button', id: null, index: -1 };
    }

    if (previousId) {
      const sameItemIndex = visibleItems.findIndex(item => item.id === previousId);
      if (sameItemIndex >= 0) {
        return { kind: 'item', id: previousId, index: sameItemIndex };
      }
    }

    const clampedIndex = Math.min(Math.max(previousIndex, 0), visibleItems.length - 1);
    return { kind: 'item', id: visibleItems[clampedIndex].id, index: clampedIndex };
  }

  private focusTarget(target: FocusTarget): void {
    if (target.kind === 'close-button') {
      document.querySelector<HTMLElement>('.notification-panel .close-btn')?.focus();
      return;
    }

    document.querySelector<HTMLElement>(`[data-notification-id="${target.id}"]`)?.focus();
  }

  applyFocusAfterMutationForTest(previousId: string | null, previousIndex: number): void {
    const target = this.resolveFocusAfterMutation(previousId, previousIndex);
    this.focusedNotificationId = target.id;
    runInInjectionContext(this.injector, () => {
      afterNextRender(() => this.focusTarget(target));
    });
  }

  preserveScrollDuringPrependForTest(list: HTMLElement, focusedNotificationId: string | null, mutate: () => void): void {
    this.preserveScrollDuringPrepend(list, focusedNotificationId, mutate);
  }

  private preserveScrollDuringPrepend(list: HTMLElement, focusedNotificationId: string | null, mutate: () => void): void {
    const beforeScrollTop = list.scrollTop;
    const beforeScrollHeight = list.scrollHeight;
    const focusedBefore = focusedNotificationId
      ? list.querySelector<HTMLElement>(`[data-notification-id="${focusedNotificationId}"]`)
      : null;
    const focusedViewportTop = focusedBefore ? focusedBefore.offsetTop - list.scrollTop : null;

    mutate();

    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        if (focusedNotificationId && focusedViewportTop !== null) {
          const focusedAfter = list.querySelector<HTMLElement>(`[data-notification-id="${focusedNotificationId}"]`);
          if (focusedAfter) {
            list.scrollTop = focusedAfter.offsetTop - focusedViewportTop;
            return;
          }
        }

        const prependedHeight = Math.max(list.scrollHeight - beforeScrollHeight, 0);
        list.scrollTop = beforeScrollTop + prependedHeight;
      });
    });
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  }

  formatTime(timestamp: string): string {
    if (!timestamp) {
      return 'Unknown';
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return date.toLocaleDateString();
  }
}
