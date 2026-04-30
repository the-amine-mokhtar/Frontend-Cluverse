import { Injectable } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { EventItem } from './event-api.service';
import { EventApiService } from './event-api.service';

export interface EventNotification {
  eventId: number;
  participationId?: number;
  eventTitle: string;
  message: string;
  type: 'warning' | 'upcoming';
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class EventNotificationService {
  private notifications$ = new Subject<EventNotification>();
  public notifications = this.notifications$.asObservable();

  private checkedEventIds = new Set<number>(); // ✅ Éviter les notifications dupliquées

  constructor(private eventApi: EventApiService) {}

  /**
   * Vérifie les events et envoie une notification s'ils sont à moins de 24h
   * ✅ AJOUT: Appel API pour déclencher l'envoi des SMS au backend
   */
  checkUpcomingEvents(participations: any[]): void {
    const now = new Date();

    participations.forEach(p => {
      if (!p.event?.startDate || !p.event?.id) return;

      const eventId = p.event.id;
      const participationId = p.id;
      const startDate = new Date(p.event.startDate);
      const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // ✅ Si l'event est à moins de 24h ET on n'a pas déjà notifié
      if (hoursUntilStart > 0 && hoursUntilStart <= 24 && !this.checkedEventIds.has(eventId)) {
        this.checkedEventIds.add(eventId);
        
        const hoursRounded = Math.floor(hoursUntilStart);
        const message = `⏰ Reminder: "${p.event.title}" starts in ${hoursRounded} hour${hoursRounded !== 1 ? 's' : ''}!`;

        this.notifications$.next({
          eventId,
          participationId,
          eventTitle: p.event.title,
          message,
          type: 'warning',
          timestamp: now,
        });

        console.log(`✅ [Notification] ${message}`);

        // ✅ AJOUT: Appel API pour envoyer SMS au backend
        if (participationId && p.wantsReminder !== false && p.userPhone) {
          this.triggerReminderSms(participationId, p.userPhone, p.event.title);
        }
      }
    });
  }

  /**
   * ✅ NOUVEAU: Déclenche l'envoi du SMS via l'API backend
   * Sans clé externe - juste l'appel direct à l'API du backend
   */
  private triggerReminderSms(participationId: number, phone: string, eventTitle: string): void {
    console.log(`📱 [SMS] Triggering SMS for participation ${participationId}, phone: ${phone}`);
    
    this.eventApi.sendReminderSms(participationId).subscribe({
      next: (result) => {
        console.log(`✅ [SMS] Reminder SMS sent successfully for participation ${participationId}:`, result.message);
        console.log(`📱 SMS sent to: ${phone} for event: "${eventTitle}"`);
      },
      error: (err) => {
        console.error(`❌ [SMS] Failed to send reminder for participation ${participationId}:`, err);
        // Ne pas faire échouer la notification locale si le SMS échoue
      },
    });
  }

  /**
   * Réinitialise les événements vérifiés (utile après rechargement des données)
   */
  reset(): void {
    this.checkedEventIds.clear();
  }
}
