import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'tai-label',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './label.component.html',
  host: {
    class: 'inline-flex',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelComponent {
  readonly forId = input<string>('');
  readonly text = input.required<string>();
  readonly required = input<boolean>(false);
}
