import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarComponent } from './sidebar.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            snapshot: { paramMap: { get: () => '1' } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render menu items', () => {
    fixture.componentRef.setInput('menuItems', [
      { label: 'Dashboard', link: '/dashboard' },
      { label: 'Settings', link: '/settings' },
    ]);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // We check for buttons inside the list items
    const buttons = compiled.querySelectorAll('button.sidebar-menu-item');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('title')).toBe('Dashboard');
    expect(buttons[1].getAttribute('title')).toBe('Settings');
  });

  it('should reflect collapsed state', () => {
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('.sidebar')?.classList.contains('collapsed'),
    ).toBe(true);
    expect(compiled.querySelector('.sidebar-header')).toBeNull();
  });
});
