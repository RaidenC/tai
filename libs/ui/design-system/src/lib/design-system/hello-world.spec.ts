import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelloWorldComponent } from './hello-world';

describe('HelloWorldComponent', () => {
  let component: HelloWorldComponent;
  let fixture: ComponentFixture<HelloWorldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelloWorldComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HelloWorldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render "Hello, World!" by default', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, World!');
  });

  it('should render the name when input is set', () => {
    fixture.componentRef.setInput('name', 'Tester');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, Tester!');
  });
});
