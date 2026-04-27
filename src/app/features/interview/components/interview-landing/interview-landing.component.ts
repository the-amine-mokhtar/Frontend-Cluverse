import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.development';

@Component({
  selector: 'app-interview-landing',
  templateUrl: './interview-landing.component.html',
  styleUrl: './interview-landing.component.scss'
})
export class InterviewLandingComponent implements OnInit {
  uniqueLink!: string;
  config: any = null;
  isLoading = true;
  error = '';

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.uniqueLink = this.route.snapshot.paramMap.get('uniqueLink')!;
    this.http.get(`${environment.apiUrl}/api/interview-configs/link/${this.uniqueLink}`).subscribe({
      next: (data: any) => {
        if (data.status === 'TERMINE') {
          this.error = 'Cet entretien a déjà été complété.';
        } else {
          this.config = data;
        }
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Lien invalide ou expiré.';
        this.isLoading = false;
      }
    });
  }

  start(): void {
    this.router.navigate(['/interview', this.uniqueLink, 'room'], {
      state: { config: this.config }
    });
  }
}
