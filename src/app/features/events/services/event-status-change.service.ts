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
  private reloadEvents$ = new Subject<void>(); // ✅ AJOUT pour recharger les events

  // Observable pour écouter les changements de statut
  onEventStatusChange(): Observable<EventStatusChange> {
    return this.eventStatusChange$.asObservable();
  }

  // ✅ Observable pour recharger tous les events
  onReloadEvents(): Observable<void> {
    return this.reloadEvents$.asObservable();
  }

  // Notifier un changement de statut (appelé depuis event-form après save)
  notifyStatusChange(eventId: number, newStatus: string, oldStatus?: string): void {
    this.eventStatusChange$.next({ eventId, newStatus, oldStatus });
  }

  // ✅ Notifier de recharger les events (appelé après création d'un nouvel event)
  notifyReloadEvents(): void {
    this.reloadEvents$.next();
  }
}