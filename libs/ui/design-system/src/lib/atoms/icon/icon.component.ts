import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TaiIconName =
  | 'bell'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-up-down'
  | 'more-vertical'
  | 'search'
  | 'empty-state';

@Component({
  selector: 'tai-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  host: {
    class: 'inline-flex leading-none',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<TaiIconName>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly decorative = input<boolean>(true);
  readonly ariaLabel = input<string>('');

  protected readonly iconClasses = computed(() => {
    const sizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-16 w-16',
    };
    return `tai-icon ${sizes[this.size()]}`;
  });
}
