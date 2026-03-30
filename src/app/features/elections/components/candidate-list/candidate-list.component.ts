import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { CandidateService } from '../../services/candidate.service';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule, RouterModule],
  templateUrl: './candidate-list.component.html',
  styleUrl: './candidate-list.component.scss'
})
export class CandidateListComponent implements OnInit {
  candidates: any[] = [];
  filteredCandidates: any[] = [];
  
  searchTerm: string = '';
  page: number = 1;
  itemsPerPage: number = 5;
  sortColumn: string = '';
  sortOrder: 'asc' | 'desc' = 'asc';

  constructor(
    private candidateService: CandidateService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Check for incoming filters like electionId or positionId
      if (params['electionId']) {
        this.searchTerm = params['electionId'];
      } else if (params['positionId']) {
        this.searchTerm = params['positionId'];
      }
      this.loadCandidates();
    });
  }

  loadCandidates(): void {
    this.candidateService.getCandidates().subscribe({
      next: (data: any) => {
        this.candidates = data || [];
        this.applyFilters();
      },
      error: (err: any) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.candidates;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(c => 
        (c.program && c.program.toLowerCase().includes(term)) ||
        (c.status && c.status.toLowerCase().includes(term)) ||
        (c.userName && c.userName.toLowerCase().includes(term)) ||
        (c.userEmail && c.userEmail.toLowerCase().includes(term)) ||
        (c.election && c.election.id && c.election.id.toString() === term) ||
        (c.electionId && c.electionId.toString() === term) ||
        (c.positionId && c.positionId.toString() === term) ||
        (c.position && c.position.id && c.position.id.toString() === term)
      );
    }

    if (this.sortColumn) {
      result.sort((a, b) => {
        const valA = a[this.sortColumn] ? a[this.sortColumn].toString().toLowerCase() : '';
        const valB = b[this.sortColumn] ? b[this.sortColumn].toString().toLowerCase() : '';
        if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.filteredCandidates = result;
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

  deleteCandidate(id: number): void {
    if (confirm('Delete this candidate?')) {
      this.candidateService.delete(id).subscribe({
        next: () => {
          this.candidates = this.candidates.filter(c => c.id !== id);
          this.applyFilters();
        },
        error: (err: any) => console.error(err)
      });
    }
  }
}
