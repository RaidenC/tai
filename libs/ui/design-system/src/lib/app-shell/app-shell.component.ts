import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent, MenuItem } from '../sidebar/sidebar.component';
import {
  UserProfileComponent,
  UserProfile,
} from '../user-profile/user-profile.component';

@Component({
  selector: 'tai-app-shell',
  standalone: true,
  imports: [CommonModule, SidebarComponent, UserProfileComponent],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  user = input<UserProfile | null>(null);
  menuItems = input<MenuItem[]>([]);
  logout = output<void>();

  onLogout(): void {
    this.logout.emit();
  }
}
