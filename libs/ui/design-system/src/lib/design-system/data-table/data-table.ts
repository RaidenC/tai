import { Component, input, output, ChangeDetectionStrategy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkTableModule } from '@angular/cdk/table';
import { CdkMenuModule } from '@angular/cdk/menu';

/**
 * Action definition for the DataTable.
 */
export interface TableActionDef<T> {
  /** Unique identifier for the action. */
  id: string;
  /** Display label for the action button/menu item. */
  label: string;
  /** Optional icon class (e.g., Lucide or FontAwesome). */
  icon?: string;
  /** Optional custom CSS classes for the action button. */
  class?: string;
  /** Optional function to determine if the action is visible for a given row. */
  visible?: (row: T) => boolean;
}

/**
 * Column definition for the DataTable.
 */
export interface TableColumnDef<T> {
  /** Unique identifier for the column. */
  id: string;
  /** Header text to display. */
  header: string;
  /** Function to extract the display value from the row. */
  cell: (row: T) => string;
  /** Whether the column supports server-side sorting. */
  sortable?: boolean;
}

/**
 * DataTableComponent
 * 
 * A reusable, headless DataTable component built using @angular/cdk/table.
 * It focuses on structural integrity, accessibility, and clean Tailwind 4.0 styling.
 * 
 * Features:
 * 1. Server-side sorting, filtering, and pagination support via signals.
 * 2. Declarative Row Actions (TableActionDef).
 * 3. Loading and Empty states.
 * 4. Responsive layout with Tailwind CSS 4.0.
 */
@Component({
  selector: 'tai-data-table',
  standalone: true,
  imports: [CommonModule, CdkTableModule, CdkMenuModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> {
  /** The data to display in the table. */
  public readonly data = input.required<T[]>();
  /** The column definitions. */
  public readonly columns = input.required<TableColumnDef<T>[]>();
  /** The action definitions. */
  public readonly actions = input<TableActionDef<T>[]>([]);
  /** Whether the table is currently loading data. */
  public readonly loading = input<boolean>(false);
  /** The total number of items available (for pagination UI). */
  public readonly totalCount = input<number>(0);
  /** Current page index (1-based). */
  public readonly pageIndex = input<number>(1);
  /** Number of items per page. */
  public readonly pageSize = input<number>(10);
  /** The current sort column ID. */
  public readonly sortColumnId = input<string | null>(null);
  /** The current sort direction. */
  public readonly sortDirection = input<'asc' | 'desc' | null>(null);

  /** Emitted when a row action is triggered. */
  public readonly actionTriggered = output<{ actionId: string; row: T }>();
  /** Emitted when sorting is changed. */
  public readonly sortChanged = output<{ columnId: string; direction: 'asc' | 'desc' }>();
  /** Emitted when the page is changed. */
  public readonly pageChanged = output<number>();

  /** Current sort state. */
  protected readonly sortState = signal<{ columnId: string; direction: 'asc' | 'desc' } | null>(null);

  constructor() {
    // Synchronize internal sortState with inputs (driven by URL)
    effect(() => {
      const colId = this.sortColumnId();
      const dir = this.sortDirection();
      if (colId && dir) {
        this.sortState.set({ columnId: colId, direction: dir });
      } else {
        this.sortState.set(null);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * IDs of the columns to be displayed, including the 'actions' column if provided.
   */
  public readonly displayedColumns = computed(() => {
    const cols = this.columns().map(c => c.id);
    if (this.actions().length > 0) {
      cols.push('actions');
    }
    return cols;
  });

  /**
   * Summary text for pagination (e.g., "Showing 1 to 10 of 25").
   */
  public readonly paginationSummary = computed(() => {
    const start = (this.pageIndex() - 1) * this.pageSize() + 1;
    const end = Math.min(this.pageIndex() * this.pageSize(), this.totalCount());
    return { start, end, total: this.totalCount() };
  });

  /**
   * Handles column sorting.
   */
  public toggleSort(columnId: string): void {
    const column = this.columns().find(c => c.id === columnId);
    if (!column?.sortable) return;

    const currentState = this.sortState();
    let newState: { columnId: string; direction: 'asc' | 'desc' } | null = null;

    if (currentState?.columnId === columnId) {
      newState = { columnId, direction: currentState.direction === 'asc' ? 'desc' : 'asc' };
    } else {
      newState = { columnId, direction: 'asc' };
    }

    this.sortState.set(newState);
    if (newState) {
      this.sortChanged.emit(newState);
    }
  }

  /**
   * Triggers an action for a specific row.
   */
  public onAction(actionId: string, row: T): void {
    this.actionTriggered.emit({ actionId, row });
  }

  /**
   * Navigates to a specific page.
   */
  public onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.pageChanged.emit(page);
  }

  /**
   * Calculates total number of pages.
   */
  protected readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  /**
   * Determines if an action is visible for a specific row.
   */
  public isActionVisible(action: TableActionDef<T>, row: T): boolean {
    return action.visible ? action.visible(row) : true;
  }
}
