import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { ElectionService } from '../../services/election.service';

@Component({
  selector: 'app-election-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule],
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

  constructor(private electionService: ElectionService) {}

  ngOnInit(): void {
    this.loadElections();
  }

  loadElections(): void {
    this.electionService.getElections().subscribe({
      next: (data) => {
        this.elections = data || [];
        this.applyFilters();
      },
      error: (err) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.elections;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(e => 
        (e.title && e.title.toLowerCase().includes(term)) ||
        (e.status && e.status.toLowerCase().includes(term))
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
        error: (err) => console.error(err)
      });
    }
  }
}
