import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { ElectionService } from '../../services/election.service';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-election-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule, RouterModule],
  templateUrl: './election-list.component.html',
  styleUrl: './election-list.component.scss'
})
export class ElectionListComponent implements OnInit {
  elections: any[] = [];
  filteredElections: any[] = [];

  searchTerm: string = '';
  page: number = 1;
  itemsPerPage: number = 5;
  sortColumn: string = '';
  sortOrder: 'asc' | 'desc' = 'asc';

  selectedElection: any = null;
  clubId: number = 0;

  constructor(
    private electionService: ElectionService,
    private authHelper: AuthHelperService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.clubId = this.authHelper.getClubId();
    this.route.queryParams.subscribe(params => {
      if (params['electionId']) {
        this.searchTerm = params['electionId'];
      } else if (params['positionId']) {
        this.searchTerm = params['positionId'];
      }
      this.loadElections();
    });
  }

  loadElections(): void {
    this.electionService.getElections(this.clubId).subscribe({
      next: (data: any) => {
        this.elections = data || [];
        this.applyFilters();
      },
      error: (err: any) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.elections;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(e =>
        (e.title && e.title.toLowerCase().includes(term)) ||
        (e.status && e.status.toLowerCase().includes(term)) ||
        (e.id && e.id.toString() === term) ||
        (e.position && e.position.id && e.position.id.toString() === term) ||
        (e.position && e.position.name && e.position.name.toLowerCase().includes(term))
      );
    }

    if (this.sortColumn) {
      result.sort((a, b) => {
        let valA = a[this.sortColumn] ? a[this.sortColumn].toString().toLowerCase() : '';
        let valB = b[this.sortColumn] ? b[this.sortColumn].toString().toLowerCase() : '';
        if (this.sortColumn === 'dates') {
          valA = a.startDate ? new Date(a.startDate).getTime() : 0;
          valB = b.startDate ? new Date(b.startDate).getTime() : 0;
        }
        if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.filteredElections = result;
    this.page = 1;
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortOrder = 'asc';
    }
    this.applyFilters();
  }

  deleteElection(id: number): void {
    if (confirm('Are you sure you want to delete this election?')) {
      this.electionService.delete(id).subscribe({
        next: () => {
          this.elections = this.elections.filter(e => e.id !== id);
          this.applyFilters();
        },
        error: (err: any) => console.error(err)
      });
    }
  }

  openDetails(election: any): void {
    this.selectedElection = election;
  }

  closeDetails(): void {
    this.selectedElection = null;
  }
}
