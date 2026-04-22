import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface EventStatusChange {
  eventId: number;
  newStatus: string;
  oldStatus?: string;
}

@Injectable({ providedIn: 'root' })
export class EventStatusChangeService {

  private eventStatusChange$ = new Subject<EventStatusChange>();

  // Observable pour écouter les changements de statut
  onEventStatusChange(): Observable<EventStatusChange> {
    return this.eventStatusChange$.asObservable();
  }

  // Notifier un changement de statut (appelé depuis event-form après save)
  notifyStatusChange(eventId: number, newStatus: string, oldStatus?: string): void {
    this.eventStatusChange$.next({ eventId, newStatus, oldStatus });
  }
}