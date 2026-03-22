import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivilegeDetailPage } from './privilege-detail.page';
import { PrivilegesStore } from './privileges.store';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Privilege, RiskLevel } from './privileges.service';

describe('PrivilegeDetailPage', () => {
  let component: PrivilegeDetailPage;
  let fixture: ComponentFixture<PrivilegeDetailPage>;
  let mockStore: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

  const mockPrivilege: Privilege = {
    id: 'priv-123',
    name: 'Portal.Users.Read',
    description: 'Read user profiles',
    module: 'Portal',
    riskLevel: RiskLevel.Low,
    isActive: true,
    rowVersion: 'AAAAAAA=',
    jitSettings: {
      maxElevationDuration: '01:00:00',
      requiresApproval: false,
      requiresJustification: true
    }
  };

  beforeEach(async () => {
    mockStore = {
      selectedPrivilege: signal<Privilege | null>(null),
      isLoading: signal(false),
      isError: signal(false),
      status: signal('Idle'),
      errorMessage: signal(null),
      loadPrivilege: vi.fn(),
      updatePrivilege: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('priv-123'),
        },
        queryParamMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [PrivilegeDetailPage, ReactiveFormsModule],
      providers: [
        { provide: PrivilegesStore, useValue: mockStore },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PrivilegeDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load privilege on init', () => {
    expect(mockStore.loadPrivilege).toHaveBeenCalledWith('priv-123');
  });

  it('should render privilege details in read-only mode', () => {
    mockStore.selectedPrivilege.set(mockPrivilege);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="display-name"]').textContent).toContain(mockPrivilege.name);
    expect(fixture.nativeElement.querySelector('[data-testid="display-module"]').textContent).toBe(mockPrivilege.module);
    expect(fixture.nativeElement.querySelector('[data-testid="display-riskLevel"]').textContent).toBe('Low');
    expect(fixture.nativeElement.querySelector('[data-testid="display-jit-duration"]').textContent).toBe('01:00:00');
  });

  it('should toggle edit mode and patch form', () => {
    mockStore.selectedPrivilege.set(mockPrivilege);
    fixture.detectChanges();
    
    component['toggleEdit']();
    
    expect(component['isEditing']()).toBe(true);
    expect(component['editForm'].value).toEqual({
      description: mockPrivilege.description,
      riskLevel: mockPrivilege.riskLevel,
      isActive: mockPrivilege.isActive,
      jitSettings: {
        maxElevationDuration: mockPrivilege.jitSettings.maxElevationDuration,
        requiresApproval: mockPrivilege.jitSettings.requiresApproval,
        requiresJustification: mockPrivilege.jitSettings.requiresJustification
      }
    });
  });

  it('should NOT allow editing immutable fields (name, module)', () => {
    mockStore.selectedPrivilege.set(mockPrivilege);
    component['isEditing'].set(true);
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector('[data-testid="input-name"]');
    const moduleInput = fixture.nativeElement.querySelector('[data-testid="input-module"]');

    if (nameInput) expect(nameInput.disabled).toBe(true);
    if (moduleInput) expect(moduleInput.disabled).toBe(true);
  });

  it('should call store.updatePrivilege on save', () => {
    mockStore.selectedPrivilege.set(mockPrivilege);
    component['isEditing'].set(true);
    component['editForm'].patchValue({
      description: 'Updated description',
      riskLevel: RiskLevel.High
    });

    component['onSave']();

    expect(mockStore.updatePrivilege).toHaveBeenCalledWith(
      'priv-123',
      expect.objectContaining({
        id: 'priv-123',
        description: 'Updated description',
        riskLevel: RiskLevel.High,
        rowVersion: 'AAAAAAA='
      })
    );

    // Simulate store Success status after async update
    mockStore.status.set('Success');
    fixture.detectChanges();
    expect(component['isEditing']()).toBe(false);
  });

  it('should navigate back to privileges catalog', () => {
    component['goBack']();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/privileges']);
  });

  it('should render error message when load fails', () => {
    mockStore.isError.set(true);
    mockStore.errorMessage.set('Privilege not found');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="error-message"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="error-message"]').textContent).toContain('Privilege not found');
  });

  it('should render refresh button when conflict occurs', () => {
    mockStore.isError.set(true);
    mockStore.errorMessage.set('concurrency conflict detected');
    fixture.detectChanges();

    const refreshBtn = fixture.nativeElement.querySelector('[data-testid="refresh-button"]');
    expect(refreshBtn).toBeTruthy();
    
    refreshBtn.click();
    expect(mockStore.loadPrivilege).toHaveBeenCalledWith('priv-123');
  });
});
