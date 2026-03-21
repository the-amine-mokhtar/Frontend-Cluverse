import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ImageCroppedEvent } from 'ngx-image-cropper';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../core/services/api.service';
import { DashboardStateService } from '../../../../core/services/dashboard-state.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {

  // ─── Form model ─────────────────────────────────────────────────────────────
  firstName           = '';
  lastName            = '';
  email               = '';
  phone               = '';
  connectionIdentifier = '';   // read-only, from API
  currentPassword  = '';   // required only when changing password
  newPassword      = '';   // new password (optional)
  confirmPassword  = '';

  // Read-only from token
  role = '';

  // ─── Photo ──────────────────────────────────────────────────────────────────
  photoPreview: string | null = null;

  // ─── Cropper state ──────────────────────────────────────────────────────────
  showCropper     = false;
  imageFile?: File;
  croppedBlob: Blob | null = null;

  // ─── UI state ───────────────────────────────────────────────────────────────
  isLoading   = false;
  isSaving    = false;
  isUploading = false;
  saveSuccess = false;
  saveError   = '';
  photoError  = '';

  private successTimer: any = null;

  constructor(
    private authHelper: AuthHelperService,
    private api: ApiService,
    private dashState: DashboardStateService
  ) {}

  ngOnInit(): void {
    this.role = this.authHelper.getRole();
    this.loadProfile();
  }

  // ─── Load profile ────────────────────────────────────────────────────────────

  private loadProfile(): void {
    this.isLoading = true;
    this.api.getMyProfile().subscribe({
      next: (profile: any) => {
        this.firstName            = profile.firstName            ?? '';
        this.lastName             = profile.lastName             ?? '';
        this.email                = profile.email                ?? '';
        this.phone                = profile.phone                ?? '';
        this.connectionIdentifier = profile.connectionIdentifier ?? '';
        this.photoPreview         = profile.photoUrl             ?? null;
        this.isLoading            = false;
      },
      error: () => {
        const payload = this.authHelper.getDecodedToken();
        if (payload) {
          this.firstName = payload.firstName ?? '';
          this.lastName  = payload.lastName  ?? '';
          this.email     = payload.email     ?? '';
          this.phone     = payload.phone     ?? '';
        }
        this.isLoading = false;
      }
    });
  }

  // ─── Photo: file selection → show cropper ────────────────────────────────────

  onPhotoChange(event: Event): void {
    this.photoError = '';
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // 2 MB size guard
    if (file.size > 2 * 1024 * 1024) {
      this.photoError = 'Image must be under 2MB.';
      input.value = '';
      return;
    }

    this.imageFile   = file;
    this.croppedBlob = null;
    this.showCropper = true;
  }

  // ─── Cropper events ──────────────────────────────────────────────────────────

  onImageCropped(event: ImageCroppedEvent): void {
    // v9 returns a blob in event.blob
    this.croppedBlob = event.blob ?? null;
  }

  onCropConfirmed(): void {
    if (!this.croppedBlob) return;

    this.showCropper = false;
    this.photoError  = '';
    this.isUploading = true;

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(this.croppedBlob);
    this.photoPreview = objectUrl;

    const formData = new FormData();
    formData.append('file', this.croppedBlob, 'profile.jpg');

    this.api.updateMyPhoto(formData).subscribe({
      next: (cloudinaryUrl: string) => {
        this.photoPreview = cloudinaryUrl;
        this.isUploading  = false;
        this.dashState.setUserProfile(this.firstName, this.lastName, cloudinaryUrl);
      },
      error: () => {
        this.photoError  = 'Photo upload failed. Please try again.';
        this.isUploading = false;
        this.photoPreview = null;
      }
    });
  }

  onCropCancelled(): void {
    this.showCropper = false;
    this.imageFile   = undefined;
    this.croppedBlob = null;
  }

  // ─── Validation ─────────────────────────────────────────────────────────────

  isPasswordMismatch(): boolean {
    if (!this.newPassword) return false;
    return this.newPassword !== this.confirmPassword;
  }

  /** current password required when new password is supplied */
  isCurrentPasswordRequired(): boolean {
    return !!this.newPassword;
  }

  isFormSubmittable(form: NgForm): boolean {
    if (form.invalid) return false;
    if (this.isPasswordMismatch()) return false;
    if (this.newPassword && !this.currentPassword) return false;
    return true;
  }

  // ─── Save profile ────────────────────────────────────────────────────────────

  onSave(form: NgForm): void {
    if (!this.isFormSubmittable(form)) return;

    this.saveError   = '';
    this.saveSuccess = false;
    this.isSaving    = true;

    const body: any = {
      firstName: this.firstName,
      lastName:  this.lastName,
      email:     this.email,
      phone:     this.phone
    };

    if (this.newPassword) {
      body.currentPassword = this.currentPassword;
      body.newPassword     = this.newPassword;
    }

    this.api.updateMyProfile(body).subscribe({
      next: () => {
        // 1. Refresh JWT so token claims reflect new name
        this.api.refreshToken().subscribe({
          next: (freshToken: string) => {
            localStorage.setItem('token', freshToken);
          },
          error: () => { /* silently ignore — old token still valid */ }
        });

        // 2. Reload dashboard state (name, role, photo)
        this.dashState.loadDashboardData();

        // 3. Also push immediately via setUserProfile
        this.dashState.setUserProfile(this.firstName, this.lastName, this.photoPreview ?? '');

        this.isSaving        = false;
        this.saveSuccess     = true;
        this.newPassword     = '';
        this.currentPassword = '';
        this.confirmPassword = '';

        if (this.successTimer) clearTimeout(this.successTimer);
        this.successTimer = setTimeout(() => {
          this.saveSuccess = false;
        }, 3500);
      },
      error: (err: unknown) => {
        this.isSaving = false;
        // Detect specific 401 "Current password is incorrect" from backend
        if (err instanceof HttpErrorResponse) {
          if (err.status === 401) {
            const body = typeof err.error === 'string' ? err.error : '';
            if (body.toLowerCase().includes('current password is incorrect')) {
              this.saveError = 'Current password is incorrect.';
              return;
            }
            this.saveError = 'Authentication failed. Please log in again.';
            return;
          }
          this.saveError = err.error?.message ?? err.message ?? 'Failed to save profile. Please try again.';
        } else {
          this.saveError = 'Failed to save profile. Please try again.';
        }
      }
    });
  }
}
