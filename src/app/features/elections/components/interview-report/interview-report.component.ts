import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

interface InterviewReport {
  sessionId: string;
  memberName: string;
  positionTitle: string;
  globalScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  technicalScore: number;
  softSkillsScore: number;
  motivationScore: number;
  recommendation: 'RECOMMENDED' | 'NEUTRAL' | 'NOT_RECOMMENDED';
  conversation: {
    role: 'recruiter' | 'user';
    text: string;
    timestampMs: number;
  }[];
}

@Component({
  selector: 'app-interview-report',
  templateUrl: './interview-report.component.html',
  styleUrls: ['./interview-report.component.scss'],
  standalone: false
})
export class InterviewReportComponent implements OnInit {
  sessionId = '';
  report: InterviewReport | null = null;
  isLoading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.sessionId = params.get('sessionId') || '';
      if (this.sessionId) {
        this.fetchReport();
      } else {
        this.error = 'Session non valide.';
        this.isLoading = false;
      }
    });
  }

  fetchReport(): void {
    this.apiService.getInterviewReport(this.sessionId).subscribe({
      next: (data) => {
        this.report = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load report', err);
        this.error = 'Impossible de charger le rapport. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }

  getRecommendationIcon(rec: string): string {
    if (rec === 'RECOMMENDED') return '✅';
    if (rec === 'NEUTRAL') return '⚠️';
    return '❌';
  }

  getRecommendationLabel(rec: string): string {
    if (rec === 'RECOMMENDED') return 'RECOMMANDÉ';
    if (rec === 'NEUTRAL') return 'NEUTRE';
    return 'NON RECOMMANDÉ';
  }

  goBack(): void {
    this.router.navigate(['/dashboard/elections/vacant-positions']);
  }
}
