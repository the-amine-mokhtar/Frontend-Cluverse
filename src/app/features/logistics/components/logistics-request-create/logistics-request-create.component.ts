import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EventItem, LogisticsApiService, ReservationCreatePayload, ResourceItem, UserItem } from '../../services/logistics-api.service';

@Component({
  selector: 'app-logistics-request-create',
  templateUrl: './logistics-request-create.component.html',
  styleUrls: ['./logistics-request-create.component.scss']
})
export class LogisticsRequestCreateComponent {
  isSubmitting = false;
  hasError = false;
  resources: ResourceItem[] = [];
  events: EventItem[] = [];
  users: UserItem[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private location: Location,
    private logisticsApi: LogisticsApiService
  ) {
    this.loadSelectData();
  }

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    neededBy: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    resourceId: [null as number | null, [Validators.required]],
    eventId: [null as number | null, [Validators.required]],
    userId: [null as number | null, [Validators.required]],
    notes: [''],
    status: ['PENDING', [Validators.required]]
  });

  private loadSelectData(): void {
    forkJoin({
      resources: this.logisticsApi.getResources(),
      events: this.logisticsApi.getEvents(),
      users: this.logisticsApi.getUsers()
    }).subscribe({
      next: ({ resources, events, users }) => {
        this.resources = resources;
        this.events = events;
        this.users = users;
      },
      error: () => {
        this.hasError = true;
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.hasError = false;

    const value = this.form.getRawValue();
    const payload: ReservationCreatePayload = {
      startDate: this.asDateTime(value.neededBy!),
      endDate: this.asDateTime(value.endDate!),
      status: value.status as ReservationCreatePayload['status'],
      quantityReserved: Number(value.quantity),
      notes: `${value.title}\n${value.notes || ''}`.trim(),
      eventId: Number(value.eventId),
      resourceId: Number(value.resourceId),
      userId: Number(value.userId)
    };

    this.logisticsApi.createReservation(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigateByUrl('/dashboard/logistics/requests');
      },
      error: () => {
        this.hasError = true;
        this.isSubmitting = false;
      }
    });
  }

  cancel(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    const fallback = this.router.url.startsWith('/logistics')
      ? '/logistics/requests'
      : '/dashboard/logistics/requests';
    void this.router.navigateByUrl(fallback);
  }

  private asDateTime(date: string): string {
    return `${date}T09:00:00`;
  }
}

