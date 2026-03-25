import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';

/**
 * PrivilegeChecker is an abstract class that must be implemented by the application
 * to provide privilege check logic to the design system.
 */
export abstract class PrivilegeChecker {
  abstract hasPrivilege(privilege: string): import('rxjs').Observable<boolean>;
}

/**
 * HasPrivilegeDirective
 * 
 * Structural directive that conditionally includes a template based on user privileges.
 * 
 * Usage:
 * <div *hasPrivilege="'Portal.Users.Create'">...</div>
 */
@Directive({
  selector: '[taiHasPrivilege]',
  standalone: true
})
export class HasPrivilegeDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private privilegeChecker = inject(PrivilegeChecker, { optional: true });
  private destroy$ = new Subject<void>();

  private _privilege = '';
  private _hasView = false;

  @Input() set taiHasPrivilege(val: string) {
    this._privilege = val;
    this.updateView();
  }

  ngOnInit(): void {
    this.updateView();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView(): void {
    if (!this._privilege || !this.privilegeChecker) {
      this.viewContainer.clear();
      this._hasView = false;
      return;
    }

    this.privilegeChecker.hasPrivilege(this._privilege)
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasPrivilege => {
        if (hasPrivilege && !this._hasView) {
          this.viewContainer.createEmbeddedView(this.templateRef);
          this._hasView = true;
        } else if (!hasPrivilege && this._hasView) {
          this.viewContainer.clear();
          this._hasView = false;
        }
      });
  }
}
