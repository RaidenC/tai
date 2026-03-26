import 'zone.js';
import 'zone.js/testing';
import { describe, it, beforeEach, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferListComponent, TransferItem } from './transfer-list';
import { signal, Component, ViewChild } from '@angular/core';

interface TestItem extends TransferItem {
  id: number;
  name: string;
}

@Component({
  standalone: true,
  imports: [TransferListComponent],
  template: `
    <tai-transfer-list
      [items]="items()"
      [initialAssignedIds]="assignedIds()"
      [displayKey]="'name'"
      [trackKey]="'id'"
      (assignedIdsChanged)="onChanged($event)"
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
  onChanged(ids: (string | number)[]) {
    this.lastChangedIds = ids;
  }
}

describe('TransferListComponent', () => {
  let host: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TransferListComponent<TestItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, TransferListComponent],
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
});
