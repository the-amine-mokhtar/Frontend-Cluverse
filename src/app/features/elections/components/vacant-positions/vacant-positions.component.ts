import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

export interface VacantPosition {
  id: number;
  title: string;
  description: string;
  presidentComment: string;
  clubId: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
}

@Component({
  selector: 'app-vacant-positions',
  templateUrl: './vacant-positions.component.html',
  styleUrls: ['./vacant-positions.component.scss'],
  standalone: false
})
export class VacantPositionsComponent implements OnInit {
  positions: VacantPosition[] = [];
  isLoading = true;
  isPresident = false;

  constructor(
    private apiService: ApiService,
    private authHelper: AuthHelperService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isPresident = this.authHelper.isPresident();
    this.loadPositions();
  }

  loadPositions(): void {
    const clubId = this.authHelper.getClubId();
    if (!clubId) {
      this.isLoading = false;
      return;
    }
    
    this.apiService.getVacantPositions(clubId).subscribe({
      next: (data) => {
        this.positions = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading positions', err);
        this.isLoading = false;
      }
    });
  }

  onCreatePosition(): void {
    this.router.navigate(['/dashboard/elections/create-position']);
  }

  onSimulateInterview(positionId: number): void {
    this.router.navigate(['/dashboard/elections/interview', positionId]);
  }
}
