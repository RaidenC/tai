import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../atoms/button/button.component';

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
  imports: [CommonModule, ButtonComponent],
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
    };
  });

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
