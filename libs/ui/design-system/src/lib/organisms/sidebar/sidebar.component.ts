import {
  Component,
  input,
  ChangeDetectionStrategy,
  booleanAttribute,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface MenuItem {
  label: string;
  link: string;
  icon?: string;
}

/**
 * SidebarComponent: The primary navigation backbone of the Portal.
 *
 * Uses local DOM navigation controls and static Tailwind/CSS classes to stay
 * compatible with strict CSP while preserving accessible router navigation.
 */
@Component({
  selector: 'tai-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  menuItems = input<MenuItem[]>([]);
  collapsed = input(false, { transform: booleanAttribute });
}
