import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { DisabilityClaim } from './disability-claim';

describe('DisabilityClaim', () => {
  let component: DisabilityClaim;
  let fixture: ComponentFixture<DisabilityClaim>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabilityClaim],
      providers: [
        provideMockStore({
          initialState: {
            claim: {
              claimId: null,
              currentStep: 1,
              borrower: {
                firstName: '',
                lastName: '',
                ssnLastFour: '',
                phone: '',
                email: '',
              },
              incident: {
                dateOfDisability: '',
                disabilityType: null,
                isWorkRelated: false,
                workersCompClaimNumber: null,
                description: '',
              },
              medicalProviders: [],
              documents: {
                employerLeaveForm: null,
                attendingPhysicianStatement: null,
              },
              isSubmitting: false,
              error: null,
            },
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DisabilityClaim);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
