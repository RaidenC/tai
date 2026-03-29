import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HasPrivilegeDirective,
  PrivilegeChecker,
} from './has-privilege.directive';

@Component({
  standalone: true,
  imports: [HasPrivilegeDirective],
  template: `
    <div id="content" *taiHasPrivilege="'Test.Privilege'">
      Authorized Content
    </div>
  `,
})
class TestComponent {}

describe('HasPrivilegeDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let privilegeSubject: BehaviorSubject<boolean>;
  let privilegeCheckerMock: Partial<PrivilegeChecker>;

  beforeEach(() => {
    privilegeSubject = new BehaviorSubject<boolean>(false);
    privilegeCheckerMock = {
      hasPrivilege: vi.fn().mockReturnValue(privilegeSubject.asObservable()),
    };

    TestBed.configureTestingModule({
      imports: [TestComponent, HasPrivilegeDirective],
      providers: [
        { provide: PrivilegeChecker, useValue: privilegeCheckerMock },
      ],
    });

    fixture = TestBed.createComponent(TestComponent);
  });

  it('should not render content if user does not have privilege', () => {
    privilegeSubject.next(false);
    fixture.detectChanges();
    const content = fixture.debugElement.query(By.css('#content'));
    expect(content).toBeNull();
  });

  it('should render content if user has privilege', () => {
    privilegeSubject.next(true);
    fixture.detectChanges();
    const content = fixture.debugElement.query(By.css('#content'));
    expect(content).not.toBeNull();
    expect(content.nativeElement.textContent.trim()).toBe('Authorized Content');
  });

  it('should remove content if privilege is revoked', () => {
    // Start with privilege
    privilegeSubject.next(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('#content'))).not.toBeNull();

    // Revoke privilege
    privilegeSubject.next(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('#content'))).toBeNull();
  });

  it('should not render anything if PrivilegeChecker is not provided', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TestComponent, HasPrivilegeDirective],
      providers: [], // No PrivilegeChecker
    });
    const newFixture = TestBed.createComponent(TestComponent);
    newFixture.detectChanges();
    const content = newFixture.debugElement.query(By.css('#content'));
    expect(content).toBeNull();
  });
});
