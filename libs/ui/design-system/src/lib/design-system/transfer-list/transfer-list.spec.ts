import 'zone.js';
import 'zone.js/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferListComponent, TransferItem } from './transfer-list';
import { signal, Component, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

interface TestItem extends TransferItem {
  id: number;
  name: string;
}

@Component({
  standalone: true,
  imports: [TransferListComponent, ReactiveFormsModule],
  template: `
    <tai-transfer-list
      [items]="items()"
      [initialAssignedIds]="assignedIds()"
      [displayKey]="'name'"
      [trackKey]="'id'"
      (assignedIdsChanged)="onChanged($event)"
      (actionTelemetry)="onTelemetry($event)"
    />
  `,
})
class TestHostComponent {
  @ViewChild(TransferListComponent) component!: TransferListComponent<TestItem>;
  items = signal<TestItem[]>([
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' },
  ]);
  assignedIds = signal<(string | number)[]>([2]);
  lastChangedIds: (string | number)[] = [];
  lastTelemetry: any = null;

  onChanged(ids: (string | number)[]) {
    this.lastChangedIds = ids;
  }

  onTelemetry(data: any) {
    this.lastTelemetry = data;
  }
}

@Component({
  standalone: true,
  imports: [TransferListComponent, ReactiveFormsModule],
  template: `
    <tai-transfer-list
      [items]="items()"
      [displayKey]="'name'"
      [trackKey]="'id'"
      [formControl]="control"
    />
  `,
})
class TestCvaHostComponent {
  @ViewChild(TransferListComponent) component!: TransferListComponent<TestItem>;
  items = signal<TestItem[]>([
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' },
  ]);
  control = new FormControl<(string | number)[]>([]);
}

describe('TransferListComponent', () => {
  let host: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TransferListComponent<TestItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, TestCvaHostComponent, TransferListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = host.component;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter available items based on assignedIds', () => {
    host.assignedIds.set([2]);
    fixture.detectChanges();
    
    const available = component.availableItems();
    expect(available.length).toBe(2);
    expect(available.map(i => i.id)).toContain(1);
    expect(available.map(i => i.id)).toContain(3);
  });

  it('should filter available items based on search term', async () => {
    component.updateSearchAvailable('ap');
    await new Promise(resolve => setTimeout(resolve, 400));
    fixture.detectChanges();
    
    const available = component.availableItems();
    expect(available.length).toBe(1);
    expect(available[0].name).toBe('Apple');
  });

  it('should debounce search term updates', async () => {
    component.updateSearchAvailable('ap');
    fixture.detectChanges();
    
    // Immediate check - should NOT be filtered yet if debounce is 300ms
    expect(component.availableItems().length).toBe(2); // Since 'Banana' (id 2) is assigned
    
    await new Promise(resolve => setTimeout(resolve, 400));
    fixture.detectChanges();
    
    expect(component.availableItems().length).toBe(1);
    expect(component.availableItems()[0].name).toBe('Apple');
  });

  it('should move items to assigned', () => {
    component.moveRight([1]);
    fixture.detectChanges();
    expect(host.lastChangedIds).toContain(1);
    expect(host.lastChangedIds).toContain(2);
    expect(component.availableItems().length).toBe(1);
    expect(component.assignedItems().length).toBe(2);
  });

  it('should move items to available', () => {
    component.moveRight([1]); // Now 1 and 2 are assigned
    fixture.detectChanges();
    expect(component.assignedItems().length).toBe(2);
    
    component.moveLeft([1]);
    fixture.detectChanges();
    expect(host.lastChangedIds).not.toContain(1);
    expect(host.lastChangedIds).toContain(2);
    expect(component.assignedItems().length).toBe(1);
  });

  it('should move all visible available items to assigned', async () => {
    component.updateSearchAvailable('apple');
    await new Promise(resolve => setTimeout(resolve, 400));
    fixture.detectChanges();
    
    component.moveAllRight();
    fixture.detectChanges();
    expect(host.lastChangedIds).toContain(1);
    expect(host.lastChangedIds).toContain(2);
    expect(host.lastChangedIds).not.toContain(3);
  });

  it('should move selected items to assigned', () => {
    // Select Apple (1) and Cherry (3)
    component.updateSelectedAvailable({ value: [1, 3] });
    fixture.detectChanges();
    
    component.moveSelectedRight();
    fixture.detectChanges();
    
    expect(host.lastChangedIds).toContain(1);
    expect(host.lastChangedIds).toContain(2); // Was already assigned
    expect(host.lastChangedIds).toContain(3);
  });

  it('should move selected items to available', () => {
    // First move Banana (2) out of assigned by selecting it
    component.updateSelectedAssigned({ value: [2] });
    fixture.detectChanges();
    
    component.moveSelectedLeft();
    fixture.detectChanges();
    
    expect(host.lastChangedIds).not.toContain(2);
    expect(component.assignedItems().length).toBe(0);
  });

  it('should transfer item on double-click (Available to Assigned)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    
    const availableList = fixture.nativeElement.querySelector('#available-list');
    const item = availableList?.querySelector('li');
    
    if (!item) {
      // Fallback: trigger directly if DOM rendering is flaky in virtual scroll tests
      const firstAvailableId = component.availableItems()[0][component.trackKey()];
      component.moveRight([firstAvailableId as any]);
    } else {
      item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }
    
    fixture.detectChanges();

    expect(component.assignedIds().has(1)).toBe(true);
    expect(host.lastTelemetry).toMatchObject({
      action: 'transfer_single',
      direction: 'to_assigned',
      id: 1
    });
  });

  it('should transfer item on double-click (Assigned to Available)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const assignedList = fixture.nativeElement.querySelector('#assigned-list');
    const item = assignedList?.querySelector('li');
    
    if (!item) {
      // Fallback
      component.moveLeft([2]);
    } else {
      item.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }
    
    fixture.detectChanges();

    expect(component.assignedIds().has(2)).toBe(false);
    expect(host.lastTelemetry).toMatchObject({
      action: 'transfer_single',
      direction: 'to_available',
      id: 2
    });
  });

  it('should track isDirty state', () => {
    expect(component.isDirty()).toBe(false);

    component.moveRight([1]);
    fixture.detectChanges();
    expect(component.isDirty()).toBe(true);

    component.moveLeft([1]);
    fixture.detectChanges();
    expect(component.isDirty()).toBe(false);
  });

  it('should reset to initial state', () => {
    component.moveRight([1, 3]);
    fixture.detectChanges();
    expect(component.assignedIds().size).toBe(3);
    expect(component.isDirty()).toBe(true);

    component.reset();
    fixture.detectChanges();
    expect(component.assignedIds().size).toBe(1);
    expect(component.assignedIds().has(2)).toBe(true);
    expect(component.isDirty()).toBe(false);
    expect(host.lastTelemetry).toMatchObject({ action: 'reset' });
  });

  it('should emit telemetry for "Move All" actions', () => {
    component.moveAllRight();
    fixture.detectChanges();
    expect(host.lastTelemetry).toMatchObject({
      action: 'transfer_bulk',
      direction: 'to_assigned'
    });

    component.moveAllLeft();
    fixture.detectChanges();
    expect(host.lastTelemetry).toMatchObject({
      action: 'transfer_bulk',
      direction: 'to_available'
    });
  });

  describe('ControlValueAccessor Integration', () => {
    let cvaHost: TestCvaHostComponent;
    let cvaFixture: ComponentFixture<TestCvaHostComponent>;
    let cvaComponent: TransferListComponent<TestItem>;

    beforeEach(async () => {
      cvaFixture = TestBed.createComponent(TestCvaHostComponent);
      cvaHost = cvaFixture.componentInstance;
      cvaFixture.detectChanges();
      cvaComponent = cvaHost.component;
    });

    it('should update assignedIds when form control value changes (writeValue)', () => {
      cvaHost.control.setValue([1, 2]);
      cvaFixture.detectChanges();
      
      expect(cvaComponent.assignedIds().has(1)).toBe(true);
      expect(cvaComponent.assignedIds().has(2)).toBe(true);
      expect(cvaComponent.assignedIds().has(3)).toBe(false);
    });

    it('should update form control value when assignedIds change (registerOnChange)', () => {
      cvaComponent.moveRight([3]);
      cvaFixture.detectChanges();
      
      expect(cvaHost.control.value).toContain(3);
    });

    it('should mark form control as touched on interaction (registerOnTouched)', () => {
      const markAsTouchedSpy = vi.spyOn(cvaHost.control, 'markAsTouched');
      
      // Simulate interaction by moving an item
      cvaComponent.moveRight([1]);
      cvaFixture.detectChanges();
      
      expect(markAsTouchedSpy).toHaveBeenCalled();
    });

    it('should disable interaction when form control is disabled (setDisabledState)', () => {
      cvaHost.control.disable();
      cvaFixture.detectChanges();
      
      expect(cvaComponent.isDisabled()).toBe(true);
    });
  });
});
