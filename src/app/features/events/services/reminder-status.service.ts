import { Injectable } from '@angular/core';
import { Participation, EventItem } from './event-api.service';

/**
 * ReminderStatusType — Types de statut de rappel
 * - 'SENT': Le rappel a été envoyé
 * - 'PENDING': Le rappel sera envoyé prochainement (dans les 24h)
 * - 'DISABLED': L'utilisateur n'a pas activé les rappels
 * - 'NO_EVENT': Aucun événement associé
 */
export type ReminderStatusType = 'SENT' | 'PENDING' | 'DISABLED' | 'NO_EVENT';

export interface ReminderStatus {
  type: ReminderStatusType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReminderStatusService {

  constructor() { }

  /**
   * Détermine le statut du rappel pour un participant
   * @param participation Le participant avec ses infos de rappel et d'événement
   * @returns L'état du rappel (SENT, PENDING, DISABLED ou NO_EVENT)
   */
  getReminderStatus(participation: Participation): ReminderStatus {

  if (!participation.event) {
    return this.getStatusObject('NO_EVENT');
  }

  // 🔥 priorité : déjà envoyé
  if (participation.reminderSent) {
    return this.getStatusObject('SENT');
  }

  // 🔕 utilisateur a désactivé
  if (!participation.wantsReminder) {
    return this.getStatusObject('DISABLED');
  }

  // ⏰ prochain rappel
  if (this.isWithin24Hours(participation.event.startDate)) {
    return this.getStatusObject('PENDING');
  }

  return this.getStatusObject('DISABLED');
}

  /**
   * Retourne l'objet ReminderStatus avec tous les détails
   */
  private getStatusObject(type: ReminderStatusType): ReminderStatus {
    const statuses: Record<ReminderStatusType, ReminderStatus> = {
      SENT: {
        type: 'SENT',
        label: 'Reminder Sent',
        icon: '✅',
        color: '#22c55e',
        description: 'You received a reminder for this event'
      },
      PENDING: {
        type: 'PENDING',
        label: 'Reminder Soon',
        icon: '⏰',
        color: '#3b82f6',
        description: 'You will receive a reminder within 24 hours'
      },
      DISABLED: {
        type: 'DISABLED',
        label: 'No Reminder',
        icon: '🔕',
        color: '#6b7280',
        description: 'You did not enable reminders for this event'
      },
      NO_EVENT: {
        type: 'NO_EVENT',
        label: 'No Event',
        icon: '❌',
        color: '#ef4444',
        description: 'No event information available'
      }
    };

    return statuses[type];
  }

  /**
   * Vérifie si la date de début de l'événement est dans les 24 heures
   */
  private isWithin24Hours(startDate: string | undefined): boolean {
    if (!startDate) return false;

    const eventDate = new Date(startDate);
    const now = new Date();
    const diffMs = eventDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours > 0 && diffHours <= 24;
  }

  /**
   * Retourne un CSS class basé sur le type de statut
   */
  getStatusClass(type: ReminderStatusType): string {
    const classMap: Record<ReminderStatusType, string> = {
      SENT: 'reminder-sent',
      PENDING: 'reminder-pending',
      DISABLED: 'reminder-disabled',
      NO_EVENT: 'reminder-no-event'
    };
    return classMap[type];
  }
}
