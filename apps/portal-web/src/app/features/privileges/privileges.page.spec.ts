import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivilegesPage } from './privileges.page';
import { PrivilegesStore } from './privileges.store';
import { RouterTestingModule } from '@angular/router/testing';
import { DialogModule } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { RiskLevel } from './privileges.service';

describe('PrivilegesPage', () => {
  let component: PrivilegesPage;
  let fixture: ComponentFixture<PrivilegesPage>;
  let storeMock: any;
  let router: Router;

  const mockPrivileges = [
    { id: '1', name: 'Portal.Users.Read', module: 'Portal', riskLevel: RiskLevel.Low, isActive: true },
    { id: '2', name: 'Portal.Users.Create', module: 'Portal', riskLevel: RiskLevel.Medium, isActive: true },
  ];

  beforeEach(async () => {
    storeMock = {
      privileges: signal(mockPrivileges),
      filteredPrivileges: signal(mockPrivileges),
      totalCount: signal(2),
      pageIndex: signal(1),
      pageSize: signal(10),
      isLoading: signal(false),
      isError: signal(false),
      isStepUpRequired: signal(false),
      errorMessage: signal<string | null>(null),
      loadPrivileges: vi.fn(),
      updatePrivilege: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PrivilegesPage, RouterTestingModule, DialogModule],
      providers: [
        { provide: PrivilegesStore, useValue: storeMock }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PrivilegesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Privilege Catalog');
  });

  it('should show step-up alert when required', () => {
    storeMock.isStepUpRequired.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Step-up authentication required');
  });

  it('should navigate to detail page on view action', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component['onAction']({ actionId: 'view', row: mockPrivileges[0] as any });
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/privileges', '1']);
  });

  it('should navigate to edit page on edit action with query params', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component['onAction']({ actionId: 'edit', row: mockPrivileges[0] as any });
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/privileges', '1'], { 
      queryParams: { edit: 'true' } 
    });
  });

  it('should call store.updatePrivilege on toggle action', () => {
    component['onAction']({ actionId: 'toggle', row: mockPrivileges[0] as any });
    expect(storeMock.updatePrivilege).toHaveBeenCalledWith('1', expect.objectContaining({ isActive: false }));
  });

  it('should update URL on search change', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component['onSearchChange']('new search');
    
    // Wait for debounceTime(400)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { search: 'new search', page: 1 }
    }));
  });

  it('should update URL on page change', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component['onPageChange'](2);
    expect(navigateSpy).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { page: 2 }
    }));
  });
});
