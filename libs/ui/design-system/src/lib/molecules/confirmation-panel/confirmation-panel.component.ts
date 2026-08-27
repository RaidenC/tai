import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ConfirmationTone = 'default' | 'danger';
export type ConfirmationActionId = 'confirm' | 'cancel';
export type ConfirmationInitialFocus = 'confirm' | 'cancel';

export interface ConfirmationPanelAction {
  label: string;
  tone?: ConfirmationTone;
  disabled?: boolean;
  loading?: boolean;
}

export interface ConfirmationPanelData {
  title: string;
  message: string;
  confirm: ConfirmationPanelAction;
  cancel: Omit<ConfirmationPanelAction, 'tone' | 'loading'>;
  ariaLabel?: string;
  initialFocus?: ConfirmationInitialFocus;
}

export interface ConfirmationPanelActionSelected {
  action: ConfirmationActionId;
}

const DEFAULT_TITLE = 'Confirm action';
const DEFAULT_MESSAGE = 'Please review this action before continuing.';
const DEFAULT_CONFIRM = 'Confirm';
const DEFAULT_CANCEL = 'Cancel';
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 500;

@Component({
  selector: 'tai-confirmation-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-panel.component.html',
  styleUrl: './confirmation-panel.component.scss',
  host: {
    class: 'block',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationPanelComponent {
  readonly data = input.required<ConfirmationPanelData>();
  readonly actionSelected = output<ConfirmationPanelActionSelected>();

  private readonly emittedAction = signal<ConfirmationActionId | null>(null);

  protected readonly titleId = 'confirmation-panel-title';
  protected readonly messageId = 'confirmation-panel-message';

  protected readonly viewModel = computed(() => {
    const data = this.data();
    const tone = data.confirm?.tone === 'danger' ? 'danger' : 'default';
    const confirmLoading = data.confirm?.loading === true;
    const confirmDisabled = confirmLoading || data.confirm?.disabled === true;
    const initialFocus = data.initialFocus === 'confirm' || data.initialFocus === 'cancel'
      ? data.initialFocus
      : tone === 'danger'
        ? 'cancel'
        : 'confirm';

    return {
      title: this.normalizeText(data.title, DEFAULT_TITLE, MAX_TITLE_LENGTH),
      message: this.normalizeText(data.message, DEFAULT_MESSAGE, MAX_MESSAGE_LENGTH),
      confirmLabel: this.normalizeText(data.confirm?.label, DEFAULT_CONFIRM, MAX_TITLE_LENGTH),
      cancelLabel: this.normalizeText(data.cancel?.label, DEFAULT_CANCEL, MAX_TITLE_LENGTH),
      ariaLabel: this.normalizeText(data.ariaLabel, this.normalizeText(data.title, DEFAULT_TITLE, MAX_TITLE_LENGTH), MAX_TITLE_LENGTH),
      tone,
      confirmLoading,
      confirmDisabled,
      cancelDisabled: data.cancel?.disabled === true || confirmLoading,
      initialFocus,
    };
  });

  initialFocusTarget(): ConfirmationInitialFocus {
    return this.viewModel().initialFocus;
  }

  protected confirmButtonClasses(): string {
    const base =
      'inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition-colors duration-200 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60';
    const toneClasses =
      this.viewModel().tone === 'danger'
        ? ' bg-red-700 hover:bg-red-800 focus-visible:ring-red-700/25'
        : ' bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600/25';

    return `${base}${toneClasses}`;
  }

  protected cancelButtonClasses(): string {
    return 'inline-flex min-h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 outline-none transition-colors duration-200 hover:bg-gray-50 focus-visible:border-blue-600 focus-visible:ring-3 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60';
  }

  protected select(action: ConfirmationActionId): void {
    if (this.emittedAction() !== null) {
      return;
    }

    const vm = this.viewModel();
    if (action === 'confirm' && vm.confirmDisabled) {
      return;
    }
    if (action === 'cancel' && vm.cancelDisabled) {
      return;
    }

    this.emittedAction.set(action);
    this.actionSelected.emit({ action });
  }

  private normalizeText(value: string | undefined, fallback: string, maxLength: number): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const normalized = trimmed.length > 0 ? trimmed : fallback;
    return normalized.slice(0, maxLength);
  }
}
