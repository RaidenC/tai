import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserProfileComponent } from './user-profile.component';
import { describe, it, expect, beforeEach } from 'vitest';

describe('UserProfileComponent', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate initials correctly', () => {
    fixture.componentRef.setInput('user', { name: 'John Doe' });
    fixture.detectChanges();
    expect(component.initials()).toBe('JD');

    fixture.componentRef.setInput('user', { name: 'Alice' });
    fixture.detectChanges();
    expect(component.initials()).toBe('A');

    fixture.componentRef.setInput('user', { name: 'Bob Smith Doe' });
    fixture.detectChanges();
    expect(component.initials()).toBe('BD');

    fixture.componentRef.setInput('user', null);
    fixture.detectChanges();
    expect(component.initials()).toBe('');
  });

  it('should render avatar if provided', () => {
    fixture.componentRef.setInput('user', {
      name: 'John Doe',
      avatar: 'path/to/avatar.png',
    });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const img = compiled.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('path/to/avatar.png');
  });

  it('should render initials if no avatar', () => {
    fixture.componentRef.setInput('user', { name: 'John Doe' });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector('.user-profile-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent?.trim()).toBe('JD');
  });

  it('should emit logout event', () => {
    const logoutSpy = vi.spyOn(component.logout, 'emit');
    component.onLogout();
    expect(logoutSpy).toHaveBeenCalled();
  });
});
