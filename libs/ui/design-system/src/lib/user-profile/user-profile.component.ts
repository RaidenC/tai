import { Component, input, output, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkMenuModule } from '@angular/cdk/menu';

export interface UserProfile {
  name: string;
  avatar?: string;
}

/**
 * UserProfileComponent: Manages the user session UI and identity context.
 * 
 * Goal Adherence:
 * 1. Zero Trust: Ensures the user identity (represented by initials) is correctly 
 *    derived from the server-provided UserProfile without exposing sensitive JWT data.
 *    By using a BFF pattern, Angular NEVER sees a token, adhering to Zero-Trust isolation.
 * 2. CSP Compliance: Avoiding Angular Material components and their potential 
 *    inline-style dependencies allows us to strictly enforce 'style-src' policies 
 *    without the 'unsafe-inline' bypass.
 * 3. Performance: Implements ChangeDetectionStrategy.OnPush, critical for responsiveness 
 *    during context switching between accounts.
 */
@Component({
  selector: 'tai-user-profile',
  standalone: true,
  imports: [CommonModule, CdkMenuModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent {
  user = input<UserProfile | null>(null);
  logout = output<void>();

  initials = computed(() => {
    const user = this.user();
    if (!user?.name) return '';
    const names = user.name.split(' ');
    if (names.length === 0) return '';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  });

  onLogout(): void {
    this.logout.emit();
  }
}
