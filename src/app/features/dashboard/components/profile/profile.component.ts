import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../core/services/api.service';
import { DashboardStateService } from '../../../../core/services/dashboard-state.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  // Form model
  firstName = '';
  lastName  = '';
  email     = '';
  phone     = '';
  password  = '';
  confirmPassword = '';

  // Read-only from token
  role = '';

  // Photo
  photoPreview: string | null = null;

  // UI state
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

  // ─── Load profile from API ──────────────────────────────────────────────────

  private loadProfile(): void {
    this.isLoading = true;
    this.api.getMyProfile().subscribe({
      next: (profile: any) => {
        this.firstName   = profile.firstName   ?? '';
        this.lastName    = profile.lastName    ?? '';
        this.email       = profile.email       ?? '';
        this.phone       = profile.phone       ?? '';
        this.photoPreview = profile.photoUrl   ?? null;
        this.isLoading   = false;
      },
      error: () => {
        // Fallback to JWT claims if API is unavailable
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

  // ─── Photo upload ───────────────────────────────────────────────────────────

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Immediate local preview via FileReader
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.photoPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Upload to backend
    this.photoError  = '';
    this.isUploading = true;
    const formData = new FormData();
    formData.append('file', file);

    this.api.updateMyPhoto(formData).subscribe({
      next: (cloudinaryUrl: string) => {
        this.photoPreview = cloudinaryUrl;
        this.isUploading  = false;
        // Push updated photo to sidebar immediately
        this.dashState.setUserProfile(this.firstName, this.lastName, cloudinaryUrl);
      },
      error: () => {
        this.photoError  = 'Photo upload failed. Please try again.';
        this.isUploading = false;
      }
    });
  }

  // ─── Validation helpers ─────────────────────────────────────────────────────

  isPasswordMismatch(form: NgForm): boolean {
    if (!this.password) return false;
    return this.password !== this.confirmPassword;
  }

  isFormSubmittable(form: NgForm): boolean {
    if (form.invalid) return false;
    if (this.password && this.password !== this.confirmPassword) return false;
    return true;
  }

  // ─── Save profile ───────────────────────────────────────────────────────────

  onSave(form: NgForm): void {
    if (!this.isFormSubmittable(form)) return;

    this.saveError   = '';
    this.saveSuccess = false;
    this.isSaving    = true;

    // Build request body — omit password if not filled
    const body: any = {
      firstName: this.firstName,
      lastName:  this.lastName,
      email:     this.email,
      phone:     this.phone
    };
    if (this.password) {
      body.password = this.password;
    }

    this.api.updateMyProfile(body).subscribe({
      next: () => {
        this.isSaving    = false;
        this.saveSuccess = true;
        this.password    = '';
        this.confirmPassword = '';
        // Push updated name + photo to sidebar immediately
        this.dashState.setUserProfile(this.firstName, this.lastName, this.photoPreview ?? '');
        if (this.successTimer) clearTimeout(this.successTimer);
        this.successTimer = setTimeout(() => {
          this.saveSuccess = false;
        }, 3500);
      },
      error: (err: Error) => {
        this.isSaving  = false;
        this.saveError = err.message || 'Failed to save profile. Please try again.';
      }
    });
  }
}
