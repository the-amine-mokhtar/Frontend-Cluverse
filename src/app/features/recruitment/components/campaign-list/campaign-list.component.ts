import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-campaign-list',
  templateUrl: './campaign-list.component.html',
  styleUrl: './campaign-list.component.scss'
})
export class CampaignListComponent implements OnInit {
  campaigns: any[] = [];
  isLoading = true;
  loadError = '';

  isPresident = false;
  clubId = 0;

  // Form State
  showForm = false;
  isEditMode = false;
  isSaving = false;
  formError = '';

  formData: any = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    maxCandidates: null
  };
  editingId: number | null = null;

  // Delete State
  confirmTarget: any = null;
  isDeleting = false;
  deleteError = '';

  // Copy success toast
  copiedId: number | null = null;

  constructor(
    private api: ApiService,
    private authHelper: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.isPresident = this.authHelper.isPresident();
    this.clubId = this.authHelper.getClubId();
    this.loadCampaigns();
  }

  loadCampaigns(): void {
    this.isLoading = true;
    this.loadError = '';
    this.api.getClubCampaigns(this.clubId).subscribe({
      next: (data) => {
        this.campaigns = data;
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Failed to load campaigns.';
        this.isLoading = false;
      }
    });
  }

  // ─── Inline Form Actions ───────────

  openNewForm(): void {
    this.showForm = true;
    this.isEditMode = false;
    this.editingId = null;
    this.formData = { title: '', description: '', startDate: '', endDate: '', maxCandidates: null };
    this.formError = '';
  }

  openEditForm(camp: any): void {
    this.showForm = true;
    this.isEditMode = true;
    this.editingId = camp.id;
    this.formData = {
      title: camp.title,
      description: camp.description,
      startDate: camp.startDate ? new Date(camp.startDate).toISOString().split('T')[0] : '',
      endDate: camp.endDate ? new Date(camp.endDate).toISOString().split('T')[0] : '',
      maxCandidates: camp.maxCandidates
    };
    this.formError = '';
  }

  closeForm(): void {
    this.showForm = false;
  }

  isFormValid(): boolean {
    return !!(
      this.formData.title &&
      this.formData.description &&
      this.formData.startDate &&
      this.formData.endDate &&
      this.formData.maxCandidates &&
      this.formData.maxCandidates > 0
    );
  }

  onSave(): void {
    if (!this.isFormValid()) return;
    this.isSaving = true;
    this.formError = '';

    const payload = { ...this.formData };

    if (this.isEditMode && this.editingId) {
      this.api.updateCampaign(this.editingId, payload).subscribe({
        next: (updated) => {
          const idx = this.campaigns.findIndex(c => c.id === this.editingId);
          if (idx !== -1) {
            this.campaigns[idx] = updated;
          }
          this.isSaving = false;
          this.closeForm();
        },
        error: () => {
          this.formError = 'Failed to update campaign.';
          this.isSaving = false;
        }
      });
    } else {
      this.api.createCampaign(this.clubId, payload).subscribe({
        next: (created) => {
          this.campaigns.unshift(created);
          this.isSaving = false;
          this.closeForm();
        },
        error: () => {
          this.formError = 'Failed to create campaign.';
          this.isSaving = false;
        }
      });
    }
  }

  // ─── Delete Actions ────────────────

  openConfirm(camp: any): void {
    this.confirmTarget = camp;
    this.deleteError = '';
  }

  closeConfirm(): void {
    this.confirmTarget = null;
  }

  onConfirmDelete(): void {
    if (!this.confirmTarget) return;
    this.isDeleting = true;
    this.deleteError = '';

    this.api.deleteCampaign(this.confirmTarget.id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c.id !== this.confirmTarget.id);
        this.isDeleting = false;
        this.closeConfirm();
      },
      error: () => {
        this.deleteError = 'Failed to delete campaign.';
        this.isDeleting = false;
      }
    });
  }

  // ─── Copy Link ─────────────────────

  copyLink(camp: any): void {
    const url = `${window.location.origin}/apply/${camp.publicLink}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copiedId = camp.id;
      setTimeout(() => {
        this.copiedId = null;
      }, 2000);
    });
  }
}
