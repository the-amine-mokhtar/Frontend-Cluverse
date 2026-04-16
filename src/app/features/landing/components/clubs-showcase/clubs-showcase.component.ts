import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment.development';

@Component({
  selector: 'app-clubs-showcase',
  templateUrl: './clubs-showcase.component.html',
  styleUrl: './clubs-showcase.component.scss'
})
export class ClubsShowcaseComponent implements OnInit {
  clubs: any[] = [];
  activeCampaigns: any[] = [];
  isLoading = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/clubs`).subscribe({
      next: (clubs) => {
        this.clubs = (clubs || []).filter(c => c.isClubVerified && c.status === 'Active');
        this.loadActiveCampaigns();
      },
      error: () => { this.isLoading = false; }
    });
  }

  loadActiveCampaigns(): void {
    const requests = this.clubs.map(club =>
      this.http.get<any[]>(`${environment.apiUrl}/api/recruitment/campaigns/club/${club.id}`)
        .toPromise()
        .then(campaigns => (campaigns || []).filter(c => c.active).map(c => ({ ...c, club })))
        .catch(() => [])
    );
    Promise.all(requests).then(results => {
      this.activeCampaigns = results.flat();
      this.isLoading = false;
    });
  }

  applyToCampaign(campaign: any): void {
    window.location.href = `/apply/${campaign.publicLink}`;
  }
}
