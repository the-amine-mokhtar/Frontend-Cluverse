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
    this.http.get<any[]>(`${environment.userApiUrl}/api/clubs`).subscribe({
      next: (clubs) => {
        this.clubs = (clubs || []).filter(c => c.isClubVerified && c.status === 'Active');
        this.loadActiveCampaigns();
      },
      error: () => { this.isLoading = false; }
    });
  }

  loadActiveCampaigns(): void {
    const requests = this.clubs.map(club =>
      this.http.get<any[]>(`${environment.userApiUrl}/api/recruitment/campaigns/club/${club.id}`)
        .toPromise()
        .then(campaigns => (campaigns || []).filter(c => c.active).map(c => ({ ...c, club })))
        .catch(() => [])
    );
    Promise.all(requests).then(results => {
      this.activeCampaigns = results.flat();
      this.isLoading = false;
    });
  }

  // ─── 3D Card Hover Logic ───
  handleMouseMove(event: MouseEvent, club: any) {
    const cardElement = event.currentTarget as HTMLElement;
    const rect = cardElement.getBoundingClientRect();
    const width = cardElement.offsetWidth;
    const height = cardElement.offsetHeight;
    
    // Calculate mouse position relative to the center of the card
    const mouseX = event.clientX - rect.left - width / 2;
    const mouseY = event.clientY - rect.top - height / 2;
    
    club.mouseX = mouseX;
    club.mouseY = mouseY;
    club.width = width;
    club.height = height;
  }

  handleMouseEnter(club: any) {
    if (club.mouseLeaveDelay) {
      clearTimeout(club.mouseLeaveDelay);
    }
  }

  handleMouseLeave(club: any) {
    club.mouseLeaveDelay = setTimeout(() => {
      club.mouseX = 0;
      club.mouseY = 0;
    }, 1000);
  }

  getCardStyle(club: any) {
    const mouseX = club.mouseX || 0;
    const mouseY = club.mouseY || 0;
    const width = club.width || 240;
    const height = club.height || 320;
    
    const mousePX = mouseX / width;
    const mousePY = mouseY / height;
    
    const rX = mousePX * 30;
    const rY = mousePY * -30;
    
    return {
      transform: `rotateY(${rX}deg) rotateX(${rY}deg)`
    };
  }

  getCardBgTransform(club: any) {
    const mouseX = club.mouseX || 0;
    const mouseY = club.mouseY || 0;
    const width = club.width || 240;
    const height = club.height || 320;
    
    const mousePX = mouseX / width;
    const mousePY = mouseY / height;
    
    const tX = mousePX * -40;
    const tY = mousePY * -40;
    
    return {
      transform: `translateX(${tX}px) translateY(${tY}px)`
    };
  }

  // Not used directly in the template if using routerLink, but remains for any programmatic navigation.
  applyToCampaign(campaign: any): void {
    window.location.href = `/apply/${campaign.publicLink}`;
  }
}
