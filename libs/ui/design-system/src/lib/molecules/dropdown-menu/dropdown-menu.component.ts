import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  QueryList,
  ViewChild,
  ViewChildren,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent, TaiIconName } from '../../atoms/icon/icon.component';

export type DropdownPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end';

export type DropdownMobileMode = 'sheet' | 'inline';

export type DropdownDensity = 'compact' | 'comfortable';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: TaiIconName;
  disabled?: boolean;
  destructive?: boolean;
  active?: boolean;
}

@Component({
  selector: 'tai-dropdown-menu',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './dropdown-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownMenuComponent {
  readonly items = input.required<DropdownMenuItem[]>();
  readonly placement = input<DropdownPlacement>('bottom-end');
  readonly mobileMode = input<DropdownMobileMode>('sheet');
  readonly density = input<DropdownDensity>('comfortable');
  readonly ariaLabel = input<string>('Menu');
  readonly triggerLabel = input<string>('');
  readonly triggerIcon = input<TaiIconName | null>(null);
  readonly testId = input<string>('dropdown-menu');

  readonly itemSelected = output<DropdownMenuItem>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  @ViewChild('triggerButton', { read: ElementRef })
  private readonly triggerButton?: ElementRef<HTMLButtonElement>;

  @ViewChildren('menuItemButton', { read: ElementRef })
  private readonly menuItemButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  protected readonly isOpen = signal(false);

  protected readonly panelClasses = computed(() => {
    const base =
      'tai-dropdown-panel origin-top-right z-50 min-w-40 max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl outline-none max-h-[min(24rem,calc(100dvh-2rem))] overflow-y-auto';
    const densityClass = ` data-[density=${this.density()}]`;
    const placementClass = this.placementClasses();
    const mobileClass =
      this.mobileMode() === 'sheet'
        ? ' max-sm:fixed max-sm:left-4 max-sm:right-4 max-sm:bottom-4 max-sm:top-auto max-sm:mt-0 max-sm:max-w-none max-sm:rounded-lg'
        : ' max-sm:static max-sm:mt-2 max-sm:max-w-none max-sm:shadow-none';

    return `${base}${densityClass} ${placementClass}${mobileClass}`;
  });

  protected readonly itemClasses = computed(() => {
    const base =
      'flex w-full items-center gap-2 border-0 bg-white text-left outline-none transition-colors duration-150 focus:ring-2 focus:ring-blue-500 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50';
    const densityClass =
      this.density() === 'compact'
        ? ' min-h-10 px-3 py-2 text-sm'
        : ' min-h-11 px-4 py-2.5 text-sm';
    return `${base}${densityClass}`;
  });

  open(focusTarget: 'first' | 'last' = 'first'): void {
    if (this.isOpen()) {
      return;
    }
    this.isOpen.set(true);
    this.opened.emit();
    afterNextRender(
      {
        write: () => this.focusEnabledItem(focusTarget),
      },
      { injector: this.injector },
    );
  }

  close(options: { restoreFocus?: boolean } = {}): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    this.closed.emit();
    if (options.restoreFocus) {
      afterNextRender(
        {
          write: () => this.triggerButton?.nativeElement.focus(),
        },
        { injector: this.injector },
      );
    }
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open();
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.open('last');
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close({ restoreFocus: true });
      return;
    }

    if (event.key === 'Tab') {
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPreviousItem();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.focusFirstEnabledItem();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.focusLastEnabledItem();
    }
  }

  protected selectItem(item: DropdownMenuItem): void {
    if (item.disabled) {
      return;
    }
    this.itemSelected.emit(item);
    this.close({ restoreFocus: true });
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target || !this.isOpen()) {
      return;
    }

    const host = this.host.nativeElement;
    if (!host.contains(target)) {
      this.close();
    }
  }

  private placementClasses(): string {
    const classes: Record<DropdownPlacement, string> = {
      'bottom-start': 'absolute left-0 right-auto top-full mt-2',
      'bottom-end': 'absolute right-0 left-auto top-full mt-2',
      'top-start': 'absolute left-0 right-auto bottom-full mb-2',
      'top-end': 'absolute right-0 left-auto bottom-full mb-2',
    };
    return classes[this.placement()];
  }

  private enabledButtons(): HTMLButtonElement[] {
    if (!this.menuItemButtons) {
      return [];
    }
    return this.menuItemButtons
      .toArray()
      .map((button) => button.nativeElement)
      .filter((button) => !button.disabled);
  }

  private focusFirstEnabledItem(): void {
    this.enabledButtons()[0]?.focus();
  }

  private focusEnabledItem(target: 'first' | 'last'): void {
    if (target === 'last') {
      this.focusLastEnabledItem();
      return;
    }
    this.focusFirstEnabledItem();
  }

  private focusLastEnabledItem(): void {
    const buttons = this.enabledButtons();
    if (buttons.length > 0) {
      buttons[buttons.length - 1]?.focus();
    }
  }

  private focusNextItem(): void {
    const buttons = this.enabledButtons();
    if (buttons.length === 0) {
      return;
    }
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(currentIndex + 1 + buttons.length) % buttons.length].focus();
  }

  private focusPreviousItem(): void {
    const buttons = this.enabledButtons();
    if (buttons.length === 0) {
      return;
    }
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(currentIndex - 1 + buttons.length) % buttons.length].focus();
  }
}
