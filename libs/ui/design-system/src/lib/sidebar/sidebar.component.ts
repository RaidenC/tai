import { Component, input, ChangeDetectionStrategy, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkMenuModule } from '@angular/cdk/menu';
import { RouterModule } from '@angular/router';
import { HasPrivilegeDirective } from '../directives/has-privilege.directive';

export interface MenuItem {
  label: string;
  link: string;
  icon?: string;
  privilege?: string;
}

/**
 * SidebarComponent: The primary navigation backbone of the Portal.
 * 
 * Goal Adherence:
 * 1. Performance: Uses ChangeDetectionStrategy.OnPush to minimize re-renders in a zoneless 
 *    environment, critical for high-frequency dashboard updates.
 * 2. Zero-Violation CSP: By using headless Angular CDK primitives and custom SCSS instead 
 *    of full Angular Material components, we avoid uncontrolled inline style injections 
 *    and ensure 100% compliance with strict 'style-src' policies (No 'unsafe-inline').
 * 3. Zero-Trust Architecture: The UI remains purely presentational, relying on the BFF 
 *    pattern to manage sensitive session state, never touching JWTs directly.
 * 4. Tiles Architecture: Designed to render dynamic menu items based on the context-switched 
 *    permissions of the active Tenant/User.
 */
@Component({
  selector: 'tai-sidebar',
  standalone: true,
  imports: [CommonModule, CdkMenuModule, RouterModule, HasPrivilegeDirective],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  menuItems = input<MenuItem[]>([]);
  collapsed = input(false, { transform: booleanAttribute });
}
