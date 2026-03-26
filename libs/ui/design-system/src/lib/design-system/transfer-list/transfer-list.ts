import { Component, input, output, ChangeDetectionStrategy, signal, computed, effect, contentChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkListboxModule } from '@angular/cdk/listbox';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Interface for items in the TransferList.
 */
export interface TransferItem {
  id: string | number;
  [key: string]: unknown;
}

/**
 * i18n dictionary for TransferList labels and ARIA tags.
 */
export interface TransferListI18n {
  availableTitle: string;
  assignedTitle: string;
  searchPlaceholder: string;
  moveSelectedRight: string;
  moveSelectedLeft: string;
  moveAllRight: string;
  moveAllLeft: string;
  reset: string;
  noItemsAvailable: string;
  noItemsAssigned: string;
}

const DEFAULT_I18N: TransferListI18n = {
  availableTitle: 'Available Items',
  assignedTitle: 'Assigned Items',
  searchPlaceholder: 'Search...',
  moveSelectedRight: 'Move selected to assigned',
  moveSelectedLeft: 'Move selected to available',
  moveAllRight: 'Move all to assigned',
  moveAllLeft: 'Move all to available',
  reset: 'Reset to initial state',
  noItemsAvailable: 'No items available',
  noItemsAssigned: 'No items assigned',
};

/**
 * TransferListComponent
 * 
 * A highly reusable, accessible (WCAG 2.1 AA) "Transfer List" component.
 * It allows users to efficiently move items between an "Available" list and an "Assigned" list.
 * 
 * Features:
 * 1. Generic Typing <T extends TransferItem>.
 * 2. Signal-based inputs and state management.
 * 3. Responsive layout with Tailwind CSS 4.0.
 * 4. WCAG 2.1 AA compliant keyboard navigation and ARIA roles.
 */
@Component({
  selector: 'tai-transfer-list',
  standalone: true,
  imports: [CommonModule, CdkListboxModule, ScrollingModule, FormsModule],
  templateUrl: './transfer-list.html',
  styleUrl: './transfer-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferListComponent<T extends TransferItem> {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  /** The full list of available items. */
  public readonly items = input.required<T[]>();
  /** IDs of items that are initially assigned. */
  public readonly initialAssignedIds = input<(string | number)[]>([]);
  /** Key to use for displaying the item label. */
  public readonly displayKey = input<keyof T>('name' as keyof T);
  /** Key to use for tracking item identity. */
  public readonly trackKey = input<keyof T>('id' as keyof T);
  /** Visual density of the component. */
  public readonly density = input<'compact' | 'comfortable'>('comfortable');
  /** Custom i18n dictionary. */
  public readonly i18n = input<TransferListI18n>(DEFAULT_I18N);

  /** Optional custom template for items. */
  public readonly itemTemplate = contentChild<TemplateRef<unknown>>('itemTemplate');

  /** Emitted when the set of assigned IDs changes. */
  public readonly assignedIdsChanged = output<(string | number)[]>();

  /** Emitted for telemetry tracking of user actions. */
  public readonly actionTelemetry = output<{
    action: 'transfer_single' | 'transfer_bulk' | 'reset';
    direction?: 'to_assigned' | 'to_available';
    id?: string | number;
    count?: number;
  }>();

  /** Detects if the screen is small (mobile/vertical layout). */
  protected readonly isSmallScreen = toSignal(
    this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(map(result => result.matches)),
    { initialValue: false }
  );

  /** Total number of items that are NOT assigned. */
  public readonly totalAvailableCount = computed(() => {
    const ids = this.assignedIds();
    const trackKey = this.trackKey();
    return this.items().filter(item => !ids.has(item[trackKey] as unknown as (string | number))).length;
  });

  /** Total number of items that ARE assigned. */
  public readonly totalAssignedCount = computed(() => this.assignedIds().size);

  /** Subject for available list search term to support debouncing. */
  private readonly searchTermAvailable$ = new Subject<string>();
  /** Subject for assigned list search term to support debouncing. */
  private readonly searchTermAssigned$ = new Subject<string>();

  /** Debounced search term for the available list. */
  protected readonly searchTermAvailable = toSignal(
    this.searchTermAvailable$.pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' }
  );
  /** Debounced search term for the assigned list. */
  protected readonly searchTermAssigned = toSignal(
    this.searchTermAssigned$.pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' }
  );

  /** IDs of items currently in the 'assigned' bucket. */
  public readonly assignedIds = signal<Set<string | number>>(new Set());

  /** Returns true if the current assigned items differ from the initial state. */
  public readonly isDirty = computed(() => {
    const current = this.assignedIds();
    const initial = new Set(this.initialAssignedIds());
    if (current.size !== initial.size) return true;
    for (const id of current) {
      if (!initial.has(id)) return true;
    }
    return false;
  });

  /** IDs of currently selected items in the available list. */
  protected readonly selectedAvailable = signal<(string | number)[]>([]);
  /** IDs of currently selected items in the assigned list. */
  protected readonly selectedAssigned = signal<(string | number)[]>([]);

  /** trackBy function for virtual scroll. */
  protected readonly trackByFn = computed(() => {
    const key = this.trackKey();
    return (index: number, item: T) => item[key];
  });

  constructor() {
    // Initialize assignedIds from input
    effect(() => {
      this.assignedIds.set(new Set(this.initialAssignedIds()));
    }, { allowSignalWrites: true });
  }

  /**
   * Filtered list of items that are NOT assigned.
   */
  public readonly availableItems = computed(() => {
    const ids = this.assignedIds();
    const term = this.searchTermAvailable().toLowerCase();
    const trackKey = this.trackKey();
    const displayKey = this.displayKey();

    return this.items().filter(item => {
      const id = item[trackKey] as unknown as (string | number);
      const isAvailable = !ids.has(id);
      if (!term) return isAvailable;
      const label = String(item[displayKey]).toLowerCase();
      return isAvailable && label.includes(term);
    });
  });

  /**
   * Filtered list of items that ARE assigned.
   */
  public readonly assignedItems = computed(() => {
    const ids = this.assignedIds();
    const term = this.searchTermAssigned().toLowerCase();
    const trackKey = this.trackKey();
    const displayKey = this.displayKey();

    return this.items().filter(item => {
      const id = item[trackKey] as unknown as (string | number);
      const isAssigned = ids.has(id);
      if (!term) return isAssigned;
      const label = String(item[displayKey]).toLowerCase();
      return isAssigned && label.includes(term);
    });
  });

  /**
   * Moves a set of IDs to the assigned bucket.
   */
  public moveRight(ids: (string | number)[]): void {
    if (ids.length === 0) return;
    const current = new Set(this.assignedIds());
    ids.forEach(id => current.add(id));
    this.updateAssigned(current);
    // Clear selection after move
    this.selectedAvailable.set([]);

    // Telemetry
    if (ids.length === 1) {
      this.actionTelemetry.emit({ action: 'transfer_single', direction: 'to_assigned', id: ids[0] });
    } else {
      this.actionTelemetry.emit({ action: 'transfer_bulk', direction: 'to_assigned', count: ids.length });
    }
  }

  /**
   * Moves a set of IDs to the available bucket.
   */
  public moveLeft(ids: (string | number)[]): void {
    if (ids.length === 0) return;
    const current = new Set(this.assignedIds());
    ids.forEach(id => current.delete(id));
    this.updateAssigned(current);
    // Clear selection after move
    this.selectedAssigned.set([]);

    // Telemetry
    if (ids.length === 1) {
      this.actionTelemetry.emit({ action: 'transfer_single', direction: 'to_available', id: ids[0] });
    } else {
      this.actionTelemetry.emit({ action: 'transfer_bulk', direction: 'to_available', count: ids.length });
    }
  }

  /**
   * Resets the component to its initial state.
   */
  public reset(): void {
    const initial = new Set(this.initialAssignedIds());
    this.updateAssigned(initial);
    this.actionTelemetry.emit({ action: 'reset' });
  }

  /**
   * Moves currently selected items from available to assigned.
   */
  public moveSelectedRight(): void {
    this.moveRight(this.selectedAvailable());
  }

  /**
   * Moves currently selected items from assigned to available.
   */
  public moveSelectedLeft(): void {
    this.moveLeft(this.selectedAssigned());
  }

  /**
   * Moves all currently visible available items to the assigned bucket.
   */
  public moveAllRight(): void {
    const trackKey = this.trackKey();
    this.moveRight(this.availableItems().map(i => i[trackKey] as unknown as (string | number)));
  }

  /**
   * Moves all currently visible assigned items to the available bucket.
   */
  public moveAllLeft(): void {
    const trackKey = this.trackKey();
    this.moveLeft(this.assignedItems().map(i => i[trackKey] as unknown as (string | number)));
  }

  /**
   * Updates the search term for the available list.
   */
  public updateSearchAvailable(term: string): void {
    this.searchTermAvailable$.next(term);
  }

  /**
   * Updates the search term for the assigned list.
   */
  public updateSearchAssigned(term: string): void {
    this.searchTermAssigned$.next(term);
  }

  /**
   * Updates the current selection in the available list.
   */
  public updateSelectedAvailable(event: any): void {
    const ids = event.value;
    this.selectedAvailable.set(Array.isArray(ids) ? ids : []);
  }

  /**
   * Updates the current selection in the assigned list.
   */
  public updateSelectedAssigned(event: any): void {
    const ids = event.value;
    this.selectedAssigned.set(Array.isArray(ids) ? ids : []);
  }

  private updateAssigned(newSet: Set<string | number>): void {
    this.assignedIds.set(newSet);
    this.assignedIdsChanged.emit(Array.from(newSet) as (string | number)[]);
  }
}
