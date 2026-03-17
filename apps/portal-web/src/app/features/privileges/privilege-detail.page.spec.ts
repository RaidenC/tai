import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivilegeDetailPage } from './privilege-detail.page';
import { PrivilegesStore } from './privileges.store';
import { RouterTestingModule } from '@angular/router/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { RiskLevel } from './privileges.service';

describe('PrivilegeDetailPage', () => {
  let component: PrivilegeDetailPage;
  let fixture: ComponentFixture<PrivilegeDetailPage>;
  let storeMock: any;

  beforeEach(async () => {
    storeMock = {
      selectedPrivilege: signal({
        id: '1',
        name: 'Test.Priv',
        description: 'Desc',
        module: 'Mod',
        riskLevel: RiskLevel.Low,
        isActive: true,
        rowVersion: '1'
      }),
      isLoading: signal(false),
      loadPrivilege: vi.fn(),
      updatePrivilege: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PrivilegeDetailPage, RouterTestingModule, ReactiveFormsModule],
      providers: [
        { provide: PrivilegesStore, useValue: storeMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PrivilegeDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should patch form with privilege data', () => {
    expect(component['form'].value.description).toBe('Desc');
    expect(component['form'].value.riskLevel).toBe(RiskLevel.Low);
  });
});
