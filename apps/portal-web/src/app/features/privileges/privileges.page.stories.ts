import type { Meta, StoryObj } from '@storybook/angular';
import { PrivilegesPage } from './privileges.page';
import { PrivilegesStore } from './privileges.store';
import { signal } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { RiskLevel } from './privileges.service';

const mockPrivileges = [
  { id: '1', name: 'Portal.Users.Read', module: 'Portal', riskLevel: RiskLevel.Low, isActive: true },
  { id: '2', name: 'Portal.Users.Create', module: 'Portal', riskLevel: RiskLevel.Medium, isActive: true },
  { id: '3', name: 'Portal.Users.Delete', module: 'Portal', riskLevel: RiskLevel.High, isActive: true },
];

const mockStore = {
  privileges: signal(mockPrivileges),
  filteredPrivileges: signal(mockPrivileges),
  totalCount: signal(3),
  pageIndex: signal(1),
  pageSize: signal(10),
  isLoading: signal(false),
  isError: signal(false),
  isStepUpRequired: signal(false),
  errorMessage: signal<string | null>(null),
  loadPrivileges: () => console.log('loadPrivileges'),
  updatePrivilege: () => console.log('updatePrivilege')
};

const meta: Meta<PrivilegesPage> = {
  component: PrivilegesPage,
  title: 'Features/Privileges/PrivilegesPage',
  decorators: [
    (story) => ({
      ...story,
      moduleMetadata: {
        imports: [RouterTestingModule],
        providers: [
          { provide: PrivilegesStore, useValue: mockStore }
        ]
      }
    })
  ]
};
export default meta;
type Story = StoryObj<PrivilegesPage>;

export const Default: Story = {
  args: {}
};

export const Loading: Story = {
  decorators: [
    (story) => {
      mockStore.isLoading.set(true);
      return story();
    }
  ]
};

export const Error: Story = {
  decorators: [
    (story) => {
      mockStore.isLoading.set(false);
      mockStore.isError.set(true);
      mockStore.errorMessage.set('Failed to fetch privileges from secure boundary.');
      return story();
    }
  ]
};

export const StepUpRequired: Story = {
  decorators: [
    (story) => {
      mockStore.isError.set(false);
      mockStore.isStepUpRequired.set(true);
      return story();
    }
  ]
};
