import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { VoteService } from '../../services/vote.service';

@Component({
  selector: 'app-vote-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule],
  templateUrl: './vote-list.component.html',
  styleUrl: './vote-list.component.scss'
})
export class VoteListComponent implements OnInit {
  votes: any[] = [];
  filteredVotes: any[] = [];
  
  searchTerm: string = '';
  page: number = 1;
  itemsPerPage: number = 5;
  sortColumn: string = '';
  sortOrder: 'asc' | 'desc' = 'asc';

  constructor(private voteService: VoteService) {}

  ngOnInit(): void {
    this.loadVotes();
  }

  loadVotes(): void {
    this.voteService.getVotes().subscribe({
      next: (data) => {
        this.votes = data || [];
        this.applyFilters();
      },
      error: (err) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.votes;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(v => 
        (v.id && v.id.toString().toLowerCase().includes(term)) ||
        (v.candidate && v.candidate.id && v.candidate.id.toString().toLowerCase().includes(term))
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

    this.filteredVotes = result;
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
}
