import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DisabilityClaim } from './disability-claim';

describe('DisabilityClaim', () => {
  let component: DisabilityClaim;
  let fixture: ComponentFixture<DisabilityClaim>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisabilityClaim],
    }).compileComponents();

    fixture = TestBed.createComponent(DisabilityClaim);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
