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

  // ─── State ────────────────────────────────────────────────────────────────
  president: Member | null = null;
  members: Member[]        = [];   // non-PRESIDENT members only
  isLoading  = false;
  loadError  = '';

  // ─── Current user ─────────────────────────────────────────────────────────
  currentUserId: number = 0;
  isPresident           = false;
  clubId: number        = 0;

  // ─── Invite form ──────────────────────────────────────────────────────────
  inviteEmail   = '';
  inviteRole    = '';
  isInviting    = false;
  inviteSuccess = '';
  inviteError   = '';

  readonly ROLES = ['MEMBER', 'TREASURER', 'HR_MANAGER', 'EVENT_MANAGER'];

  // ─── Confirm remove dialog ────────────────────────────────────────────────
  confirmTarget: Member | null = null;
  isRemoving  = false;
  removeError = '';

  // ─── Deactivate/activate ──────────────────────────────────────────────────
  isTogglingActive: { [userId: number]: boolean } = {};

  // per-row role update error message
  roleError: { [userId: number]: string } = {};

  // ─── Fade-in trigger ──────────────────────────────────────────────────────
  membersLoaded = false;

  constructor(
    private api: ApiService,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.clubId       = this.authHelper.getClubId();
    // Use decoded token .sub (standard JWT subject) cast to number
    const payload     = this.authHelper.getDecodedToken();
    this.currentUserId = payload?.sub ? Number(payload.sub) : 0;
    this.isPresident  = this.authHelper.isPresident();
    this.loadMembers();
  }

  // ─── Load & split members ─────────────────────────────────────────────────

  loadMembers(): void {
    this.isLoading     = true;
    this.loadError     = '';
    this.membersLoaded = false;

    this.api.getClubMembers(this.clubId).subscribe({
      next: (data: Member[]) => {
        this.president = data.find(m => m.role === 'PRESIDENT') ?? null;
        this.members   = data.filter(m => m.role !== 'PRESIDENT');
        this.isLoading = false;
        setTimeout(() => { this.membersLoaded = true; }, 50);
      },
      error: () => {
        this.loadError = 'Failed to load members. Please refresh the page.';
        this.isLoading = false;
      }
    });
  }

  // ─── Invite member ────────────────────────────────────────────────────────

  onInvite(): void {
    if (!this.inviteEmail || !this.inviteRole) return;

    this.isInviting    = true;
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

  // ─── Confirm remove dialog ────────────────────────────────────────────────

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

    this.isRemoving  = true;
    this.removeError = '';
    const targetId   = this.confirmTarget.userId;

    this.api.removeMember(this.clubId, targetId).subscribe({
      next: () => {
        this.members    = this.members.filter(m => m.userId !== targetId);
        this.isRemoving = false;
        this.closeConfirm();
      },
      error: (err: unknown) => {
        this.isRemoving = false;
        const msg = err instanceof HttpErrorResponse
          ? (typeof err.error === 'string' ? err.error : (err.error?.message ?? err.message ?? ''))
          : '';
        this.removeError = msg || 'Failed to remove member. Please try again.';
      }
    });
  }

  // ─── Deactivate / Activate ────────────────────────────────────────────────

  onDeactivate(member: Member): void {
    this.isTogglingActive[member.userId] = true;

    this.api.deactivateMember(this.clubId, member.userId).subscribe({
      next: () => {
        member.active                             = false;
        this.isTogglingActive[member.userId]      = false;
      },
      error: () => {
        this.isTogglingActive[member.userId] = false;
      }
    });
  }

  onActivate(member: Member): void {
    this.isTogglingActive[member.userId] = true;

    this.api.activateMember(this.clubId, member.userId).subscribe({
      next: () => {
        member.active                        = true;
        this.isTogglingActive[member.userId] = false;
      },
      error: () => {
        this.isTogglingActive[member.userId] = false;
      }
    });
  }

  onRoleChange(member: Member, event: Event): void {
    const selectParams = event.target as HTMLSelectElement;
    const newRole = selectParams.value;
    const previousRole = member.role;

    if (newRole === previousRole) return;

    this.roleError[member.userId] = '';
    // Optimistic update
    member.role = newRole;

    this.api.updateMemberRole(this.clubId, member.userId, newRole).subscribe({
      next: () => {
        // success, already updated optimistically
      },
      error: (err: unknown) => {
        // Revert on error
        member.role = previousRole;
        const msg = err instanceof HttpErrorResponse
          ? (typeof err.error === 'string' ? err.error : (err.error?.message ?? err.message ?? ''))
          : '';
        this.roleError[member.userId] = msg || 'Failed to update role.';
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'PRESIDENT':     return 'badge--purple';
      case 'MEMBER':        return 'badge--blue';
      case 'TREASURER':     return 'badge--amber';
      case 'HR_MANAGER':    return 'badge--green';
      case 'EVENT_MANAGER': return 'badge--coral';
      default:              return 'badge--blue';
    }
  }

  formatRoleLabel(role: string): string {
    return role.replace(/_/g, ' ');
  }

  isCurrentUser(member: Member): boolean {
    return member.userId === this.currentUserId;
  }
}
