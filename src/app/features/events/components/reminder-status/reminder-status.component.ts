// reminder-status.component.ts
import { Component, Input, OnChanges } from '@angular/core';
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

  ngOnChanges(): void {
    if (!this.participation) return;

    this.reminderStatus =
      this.reminderStatusService.getReminderStatus(this.participation);
  }

  getStatusClass(): string {
    if (!this.reminderStatus) return 'status-unknown';

    return this.reminderStatusService.getStatusClass(
      this.reminderStatus.type
    );
  }
}