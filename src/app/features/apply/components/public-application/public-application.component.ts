import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-public-application',
  templateUrl: './public-application.component.html',
  styleUrl: './public-application.component.scss'
})
export class PublicApplicationComponent implements OnInit {
  campaign: any = null;
  questions: any[] = [];
  
  isLoading = true;
  loadError = '';
  isExpired = false;

  // Submit State
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';

  // Fixed fields
  candidateName = '';
  candidateEmail = '';
  candidatePhone = '';

  // Answers Map: questionId -> answer (string)
  answers: { [key: number]: any } = {};

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const publicLink = this.route.snapshot.paramMap.get('publicLink');
    if (publicLink) {
      this.loadCampaign(publicLink);
    } else {
      this.loadError = 'Invalid campaign link provided.';
      this.isLoading = false;
    }
  }

  loadCampaign(publicLink: string): void {
    this.api.getCampaignByPublicLink(publicLink).subscribe({
      next: (camp) => {
        this.campaign = camp;
        
        if (camp.endDate && new Date() > new Date(camp.endDate)) {
          this.isExpired = true;
          this.isLoading = false;
          return;
        }
        
        // Ensure questions array is sorted
        this.questions = (camp.questions || []).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
        
        // Initialize answer dict
        this.questions.forEach(q => {
          this.answers[q.id] = (q.type === 'YES_NO') ? null : '';
          this.parseOptions(q);
        });

        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Campaign not found or an error occurred. The link may be invalid or expired.';
        this.isLoading = false;
      }
    });
  }

  parseOptions(q: any): void {
    if (q.type === 'MULTIPLE_CHOICE' && q.options) {
      try {
        q.parsedOptions = JSON.parse(q.options);
      } catch(e) {
        q.parsedOptions = [];
      }
    }
  }

  setRating(qId: number, rating: number): void {
    this.answers[qId] = rating.toString();
  }

  onFileChange(event: any, qId: number): void {
    const file = event.target.files[0];
    if (file) {
      // Temporarily store the file name to fulfill the string requirement for the payload
      this.answers[qId] = file.name;
    }
  }

  isFormValid(): boolean {
    if (!this.candidateName || !this.candidateEmail) return false;
    
    for (const q of this.questions) {
      if (q.required) {
        const val = this.answers[q.id];
        if (val === null || val === undefined || val === '') {
          return false;
        }
      }
    }
    return true;
  }

  onSubmit(): void {
    if (!this.isFormValid() || !this.campaign) return;
    this.isSubmitting = true;
    this.submitError = '';

    const payload = {
      candidateName: this.candidateName,
      candidateEmail: this.candidateEmail,
      candidatePhone: this.candidatePhone,
      answers: this.questions.map(q => ({
        questionId: q.id,
        answer: String(this.answers[q.id] || '')
      }))
    };

    this.api.applyToCampaign(this.campaign.id, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.submitSuccess = true;
      },
      error: () => {
        this.isSubmitting = false;
        this.submitError = 'Failed to submit your application. Please try again later.';
      }
    });
  }
}
