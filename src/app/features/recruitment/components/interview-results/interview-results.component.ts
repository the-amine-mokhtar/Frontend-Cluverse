import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-interview-results',
  templateUrl: './interview-results.component.html',
  styleUrl: './interview-results.component.scss'
})
export class InterviewResultsComponent implements OnInit {
  campaignId!: number;
  isLoading = true;
  loadError = '';
  applications: any[] = [];
  selectedResult: any = null;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.campaignId = +id;
      this.loadResults();
    }
  }

  loadResults(): void {
    this.isLoading = true;
    this.api.getCampaignApplications(this.campaignId).subscribe({
      next: (apps) => {
        this.applications = (apps || []).filter(a => a.status === 'INTERVIEW' || a.status === 'ACCEPTED' || a.status === 'REJECTED');
        this.applications.forEach(app => {
          this.api.getInterviewResult(app.id).subscribe({
            next: (result) => {
              if (result?.report?.strengths) {
                result.report.strengths = this.parseJsonArray(result.report.strengths);
              }
              if (result?.report?.weaknesses) {
                result.report.weaknesses = this.parseJsonArray(result.report.weaknesses);
              }
              app.interviewResult = result;
            },
            error: () => { app.interviewResult = null; }
          });
        });
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Erreur lors du chargement des résultats.';
        this.isLoading = false;
      }
    });
  }

  parseJsonArray(str: string): string[] {
    try { return JSON.parse(str); } catch { return []; }
  }

  openDetail(app: any): void {
    this.selectedResult = app;
  }

  closeDetail(): void {
    this.selectedResult = null;
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  }
}
