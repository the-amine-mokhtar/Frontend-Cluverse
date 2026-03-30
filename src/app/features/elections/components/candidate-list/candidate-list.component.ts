import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { CandidateService } from '../../services/candidate.service';

@Component({
  selector: 'app-candidate-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule],
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

  constructor(private candidateService: CandidateService) {}

  ngOnInit(): void {
    this.loadCandidates();
  }

  loadCandidates(): void {
    this.candidateService.getCandidates().subscribe({
      next: (data) => {
        this.candidates = data || [];
        this.applyFilters();
      },
      error: (err) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.candidates;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(c => 
        (c.program && c.program.toLowerCase().includes(term)) ||
        (c.status && c.status.toLowerCase().includes(term))
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
        error: (err) => console.error(err)
      });
    }
  }
}
