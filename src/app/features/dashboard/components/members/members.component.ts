import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

interface Member {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  joinDate?: string;
  active?: boolean;
}

@Component({
  selector: 'app-members',
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss']
})
export class MembersComponent implements OnInit {

  // ─── State ───────────────────────────────────────────────────────────────────
  members: Member[] = [];
  isLoading       = false;
  loadError       = '';

  // ─── Current user (to hide Remove button on own row) ─────────────────────────
  currentUserId: number = 0;
  isPresident      = false;
  clubId: number   = 0;

  // ─── Invite form ─────────────────────────────────────────────────────────────
  inviteEmail = '';
  inviteRole  = '';
  isInviting  = false;
  inviteSuccess = '';
  inviteError   = '';

  readonly ROLES = ['MEMBER', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'];

  // ─── Confirm dialog ───────────────────────────────────────────────────────────
  confirmTarget: Member | null = null;
  isRemoving = false;
  removeError = '';

  // ─── Fade-in animation trigger ────────────────────────────────────────────────
  membersLoaded = false;

  constructor(
    private api: ApiService,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.clubId       = this.authHelper.getClubId();
    this.currentUserId = this.authHelper.getUserId();
    this.isPresident  = this.authHelper.isPresident();
    this.loadMembers();
  }

  // ─── Load members ──────────────────────────────────────────────────────────────

  loadMembers(): void {
    this.isLoading    = true;
    this.loadError    = '';
    this.membersLoaded = false;

    this.api.getClubMembers(this.clubId).subscribe({
      next: (data: Member[]) => {
        this.members      = data;
        this.isLoading    = false;
        // Tiny delay lets Angular render then apply the class for CSS animation
        setTimeout(() => { this.membersLoaded = true; }, 50);
      },
      error: () => {
        this.loadError = 'Failed to load members. Please refresh the page.';
        this.isLoading = false;
      }
    });
  }

  // ─── Invite member ──────────────────────────────────────────────────────────────

  onInvite(): void {
    if (!this.inviteEmail || !this.inviteRole) return;

    this.isInviting   = true;
    this.inviteSuccess = '';
    this.inviteError   = '';

    this.api.inviteMember(this.clubId, this.inviteEmail, this.inviteRole).subscribe({
      next: () => {
        this.inviteSuccess = `Invitation sent to ${this.inviteEmail}`;
        this.inviteEmail   = '';
        this.inviteRole    = '';
        this.isInviting    = false;
        this.loadMembers();
      },
      error: (err: unknown) => {
        this.isInviting = false;
        if (err instanceof HttpErrorResponse) {
          const body = typeof err.error === 'string' ? err.error : (err.error?.message ?? '');
          if (body.toLowerCase().includes('already') || err.status === 409) {
            this.inviteError = 'This person is already a member of the club.';
          } else {
            this.inviteError = body || 'Failed to send invitation. Please try again.';
          }
        } else {
          this.inviteError = 'Failed to send invitation. Please try again.';
        }
      }
    });
  }

  isInviteFormValid(): boolean {
    return this.inviteEmail.trim().length > 0
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.inviteEmail)
      && this.inviteRole.length > 0;
  }

  // ─── Confirm dialog ────────────────────────────────────────────────────────────

  openConfirm(member: Member): void {
    this.confirmTarget = member;
    this.removeError   = '';
  }

  closeConfirm(): void {
    this.confirmTarget = null;
    this.removeError   = '';
  }

  onConfirmRemove(): void {
    if (!this.confirmTarget) return;

    this.isRemoving = true;
    this.removeError = '';
    const targetId = this.confirmTarget.userId;

    this.api.removeMember(this.clubId, targetId).subscribe({
      next: () => {
        // Remove from list immediately — no full reload needed
        this.members = this.members.filter(m => m.userId !== targetId);
        this.isRemoving = false;
        this.closeConfirm();
      },
      error: (err: unknown) => {
        this.isRemoving = false;
        const msg = err instanceof HttpErrorResponse
          ? (err.error?.message ?? err.message ?? '')
          : '';
        this.removeError = msg || 'Failed to remove member. Please try again.';
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'PRESIDENT':    return 'badge--purple';
      case 'MEMBER':       return 'badge--blue';
      case 'TREASURER':    return 'badge--amber';
      case 'HR_MANAGER':   return 'badge--green';
      case 'EVENT_MANAGER': return 'badge--coral';
      default:             return 'badge--blue';
    }
  }

  formatRoleLabel(role: string): string {
    return role.replace(/_/g, ' ');
  }

  isCurrentUser(member: Member): boolean {
    return member.id === this.currentUserId;
  }
}
