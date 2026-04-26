import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

interface Member { id: number; userId: number; firstName: string; lastName: string; email: string; }
interface MemberPayment {
  id: number;
  membership: { id: number; user: { firstName: string; lastName: string; email: string; }; };
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  dueDate: string;
}

@Component({
  selector: 'app-member-dues',
  templateUrl: './member-dues.component.html',
  styleUrl: './member-dues.component.scss'
})
export class MemberDuesComponent implements OnInit {

  payments: MemberPayment[] = [];
  members: Member[] = [];
  clubId = 0;
  isLoading = false;
  error = '';
  reminderMsg = '';

  showForm = false;
  isSubmitting = false;
  formError = '';
  editId: number | null = null;

  form: { membershipId: number | null; amount: number | null; status: string; dueDate: string } = {
    membershipId: null, amount: null, status: 'PENDING', dueDate: ''
  };

  readonly STATUSES = ['PAID', 'PENDING', 'OVERDUE'];

  constructor(private api: ApiService, private authHelper: AuthHelperService) {}

  ngOnInit(): void {
    this.clubId = this.authHelper.getClubId();
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading = true;
    this.error = '';
    this.api.getClubMembers(this.clubId).subscribe({
      next: (m) => { this.members = m; },
      error: () => {}
    });
    this.api.getMemberPayments(this.clubId).subscribe({
      next: (data) => { this.payments = data; this.isLoading = false; },
      error: () => { this.error = 'Failed to load payments.'; this.isLoading = false; }
    });
  }

  openAdd(): void {
    this.editId = null;
    this.form = { membershipId: null, amount: null, status: 'PENDING', dueDate: '' };
    this.formError = '';
    this.showForm = true;
  }

  openEdit(p: MemberPayment): void {
    this.editId = p.id;
    this.form = {
      membershipId: p.membership.id,
      amount: p.amount,
      status: p.status,
      dueDate: p.dueDate
    };
    this.formError = '';
    this.showForm = true;
  }

  onSubmit(): void {
    if (!this.form.membershipId || !this.form.amount || !this.form.dueDate) {
      this.formError = 'All fields required.';
      return;
    }
    this.isSubmitting = true;
    this.formError = '';

    const payload = { amount: this.form.amount, status: this.form.status, dueDate: this.form.dueDate };

    const req$ = this.editId != null
      ? this.api.updateMemberPayment(this.editId, { ...payload, membership: { id: this.form.membershipId }, club: { id: this.clubId } })
      : this.api.createMemberPayment(this.form.membershipId, this.clubId, payload);

    req$.subscribe({
      next: () => { this.showForm = false; this.isSubmitting = false; this.loadAll(); },
      error: () => { this.formError = 'Save failed.'; this.isSubmitting = false; }
    });
  }

  onDelete(id: number): void {
    if (!confirm('Delete this payment?')) return;
    this.api.deleteMemberPayment(id).subscribe({ next: () => this.loadAll(), error: () => {} });
  }

  onRemind(): void {
    this.reminderMsg = '';
    this.api.sendPaymentReminders(this.clubId).subscribe({
      next: (count) => { this.reminderMsg = `Reminders sent for ${count} member(s).`; },
      error: () => { this.reminderMsg = 'Failed to send reminders.'; }
    });
  }

  getStatusClass(s: string): string {
    if (s === 'PAID') return 'dues-badge--paid';
    if (s === 'OVERDUE') return 'dues-badge--overdue';
    return 'dues-badge--pending';
  }

  memberName(p: MemberPayment): string {
    return p.membership?.user?.firstName + ' ' + p.membership?.user?.lastName;
  }

  memberEmail(p: MemberPayment): string {
    return p.membership?.user?.email ?? '';
  }

  getMemberName(m: Member): string {
    return m.firstName + ' ' + m.lastName;
  }
}
