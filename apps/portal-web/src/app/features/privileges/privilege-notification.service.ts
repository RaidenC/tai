import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { PrivilegesStore } from './privileges.store';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PrivilegeNotificationService {
  private readonly store = inject(PrivilegesStore);
  private hubConnection: signalR.HubConnection | null = null;
  private readonly privilegeChangedSubject = new Subject<{ id: string, name: string }>();
  
  public privilegeChanged$ = this.privilegeChangedSubject.asObservable();

  public init(): void {
    if (this.hubConnection) return;
    this.startConnection();
  }

  private startConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/privileges')
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR: Connected to PrivilegeHub'))
      .catch(err => console.error('SignalR: Error while starting connection: ' + err));

    this.hubConnection.on('PrivilegeChanged', (data: { id: string, name: string }) => {
      console.log('SignalR: Privilege changed', data);
      this.privilegeChangedSubject.next(data);
      
      // Auto-refresh the list if we are on the catalog page
      this.store.loadPrivileges();
    });
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }
}
