import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DropdownMenuComponent, DropdownMenuItem } from './dropdown-menu.component';

const items: DropdownMenuItem[] = [
  { id: 'profile', label: 'My Profile' },
  { id: 'settings', label: 'Account Settings' },
  { id: 'disabled', label: 'Disabled Action', disabled: true },
  { id: 'logout', label: '<img src=x onerror=alert(1)>Logout', destructive: true },
];

describe('DropdownMenuComponent', () => {
  let component: DropdownMenuComponent;
  let fixture: ComponentFixture<DropdownMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('triggerLabel', 'Actions');
    fixture.componentRef.setInput('ariaLabel', 'Actions');
    fixture.componentRef.setInput('testId', 'actions');
    fixture.detectChanges();
  });

  it('creates and renders a closed trigger', () => {
    expect(component).toBeTruthy();
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('opens and closes from trigger click', () => {
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('focuses the first enabled item after a keyboard open renders', async () => {
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));

    const firstEnabledItem = fixture.nativeElement.querySelector(
      '[role="menuitem"]:not([disabled])',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(firstEnabledItem);
  });

  it('focuses the last enabled item when ArrowUp opens the menu', async () => {
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await Promise.resolve();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));

    const enabledItems = Array.from(
      fixture.nativeElement.querySelectorAll('[role="menuitem"]:not([disabled])'),
    ) as HTMLButtonElement[];
    expect(document.activeElement).toBe(enabledItems[enabledItems.length - 1]);
  });

  it('emits selected item for enabled item, closes, and restores trigger focus', async () => {
    const spy = vi.fn();
    component.itemSelected.subscribe(spy);

    component.open();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    const profile = fixture.nativeElement.querySelector('[data-testid="action-profile"]') as HTMLButtonElement;
    profile.click();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(items[0]);
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not emit for disabled item', () => {
    const spy = vi.fn();
    component.itemSelected.subscribe(spy);

    component.open();
    fixture.detectChanges();
    const disabled = fixture.nativeElement.querySelector('[data-testid="action-disabled"]') as HTMLButtonElement;
    disabled.click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('renders labels as text instead of HTML', () => {
    component.open();
    fixture.detectChanges();

    const logout = fixture.nativeElement.querySelector('[data-testid="action-logout"]') as HTMLElement;
    expect(logout.textContent).toContain('<img src=x onerror=alert(1)>Logout');
    expect(logout.querySelector('img')).toBeNull();
  });

  it('closes on Escape and returns focus to trigger', async () => {
    component.open();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('[data-testid="actions-trigger"]') as HTMLButtonElement;
    const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('moves focus with arrow keys and Home/End', async () => {
    component.open();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    const enabledItems = () =>
      Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]:not([disabled])')) as HTMLButtonElement[];

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    const items = enabledItems();
    expect(document.activeElement).toBe(items[items.length - 1]);

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(enabledItems()[0]);

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(enabledItems()[1]);
  });

  it('applies placement, density, and mobile mode classes', () => {
    fixture.componentRef.setInput('placement', 'top-start');
    fixture.componentRef.setInput('density', 'compact');
    fixture.componentRef.setInput('mobileMode', 'sheet');
    component.open();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement;
    expect(panel.className).toContain('bottom-full');
    expect(panel.className).toContain('right-auto');
    expect(panel.className).toContain('data-[density=compact]');
    expect(panel.className).toContain('max-sm:fixed');
  });

  it('closes when clicking outside', () => {
    component.open();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });
});
