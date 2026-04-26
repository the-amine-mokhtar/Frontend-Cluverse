import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-create-position',
  templateUrl: './create-position.component.html',
  styleUrls: ['./create-position.component.scss'],
  standalone: false
})
export class CreatePositionComponent implements OnInit {
  isSubmitting = false;
  
  // Available standard positions
  availableTitles = [
    'Trésorier',
    'Responsable RH',
    'Chef Recrutement',
    'Responsable Logistique',
    'Responsable Communication',
    'Responsable Évènementiel',
    'Responsable Sponsoring',
    'Secrétaire Général',
    'Vice-Président',
    'Autre'
  ];

  formData = {
    title: '',
    customTitle: '',
    description: '',
    presidentComment: '',
    status: 'OPEN'
  };

  constructor(
    private router: Router,
    private authHelper: AuthHelperService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    if (!this.authHelper.isPresident()) {
      this.router.navigate(['/dashboard/elections/vacant-positions']);
    }
  }

  get isOtherSelected(): boolean {
    return this.formData.title === 'Autre';
  }

  isFormValid(): boolean {
    const isTitleValid = this.isOtherSelected ? this.formData.customTitle.trim().length > 0 : this.formData.title.length > 0;
    const isDescriptionValid = this.formData.description.trim().length > 0;
    return isTitleValid && isDescriptionValid && !this.isSubmitting;
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    const clubId = this.authHelper.getClubId();
    if (!clubId) return;

    this.isSubmitting = true;

    // Prepare payload
    const payload = {
      title: this.isOtherSelected ? this.formData.customTitle : this.formData.title,
      description: this.formData.description,
      presidentComment: this.formData.presidentComment,
      status: 'OPEN'
    };

    this.apiService.createVacantPosition(clubId, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/dashboard/elections/vacant-positions']);
      },
      error: (err) => {
        console.error('Error creating position', err);
        this.isSubmitting = false;
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/dashboard/elections/vacant-positions']);
  }
}
