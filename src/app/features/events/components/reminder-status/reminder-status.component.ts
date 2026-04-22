// reminder-status.component.ts
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Participation } from '../../services/event-api.service';
import { ReminderStatusService, ReminderStatus } from '../../services/reminder-status.service';

@Component({
  selector: 'app-reminder-status',
  templateUrl: './reminder-status.component.html',
  styleUrls: ['./reminder-status.component.scss']
})
export class ReminderStatusComponent implements OnChanges {
  @Input() participation!: Participation;

  reminderStatus: ReminderStatus | null = null;

  constructor(private reminderStatusService: ReminderStatusService) {}

  // ✅ FIX #1 — ngOnChanges au lieu de ngOnInit pour réagir aux changements de @Input
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['participation'] && this.participation) {
      this.reminderStatus = this.reminderStatusService.getReminderStatus(this.participation);
    }
  }

  // ✅ FIX #2 — guard null explicite
  getStatusClass(): string {
    if (!this.reminderStatus) return 'status-unknown';
    return this.reminderStatusService.getStatusClass(this.reminderStatus.type);
  }
}