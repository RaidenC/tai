import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnDestroy, InjectionToken } from '@angular/core';
import { Subject, takeUntil, Observable } from 'rxjs';

/**
 * Interface for Privilege Checking to avoid circular dependencies.
 */
export interface PrivilegeChecker {
  hasPrivilege(privilege: string): Observable<boolean>;
}

/**
 * InjectionToken for the Auth Service.
 */
export const TAI_AUTH_SERVICE = new InjectionToken<PrivilegeChecker>('TAI_AUTH_SERVICE');

/**
 * HasPrivilegeDirective (*taiHasPrivilege)
 * 
 * A structural directive that conditionally renders a template based on
 * whether the current user has the required privilege.
 */
@Directive({
  selector: '[taiHasPrivilege]',
  standalone: true
})
export class HasPrivilegeDirective implements OnDestroy {
  private readonly templateRef = inject(TemplateRef<any>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(TAI_AUTH_SERVICE);
  
  private readonly destroy$ = new Subject<void>();
  private isVisible = false;

  @Input('taiHasPrivilege') set privilege(value: string) {
    this.checkPrivilege(value);
  }

  private checkPrivilege(value: string): void {
    this.authService.hasPrivilege(value)
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasAccess => {
        if (hasAccess && !this.isVisible) {
          this.viewContainer.createEmbeddedView(this.templateRef);
          this.isVisible = true;
        } else if (!hasAccess && this.isVisible) {
          this.viewContainer.clear();
          this.isVisible = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
