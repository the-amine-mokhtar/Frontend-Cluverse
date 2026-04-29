import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { VoteService } from '../../services/vote.service';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-vote-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule, RouterModule],
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

  constructor(
    private voteService: VoteService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      
      if (params['electionId']) {
        this.searchTerm = params['electionId'];
      } else if (params['candidateId']) {
        this.searchTerm = params['candidateId'];
      } else if (params['positionId']) {
        this.searchTerm = params['positionId'];
      }
      this.loadVotes();
    });
  }

  loadVotes(): void {
    this.voteService.getVotes().subscribe({
      next: (data: any) => {
        this.votes = data || [];
        this.applyFilters();
      },
      error: (err: any) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.votes;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(v => 
        (v.id && v.id.toString() === term) ||
        (v.candidate && v.candidate.id && v.candidate.id.toString() === term) ||
        (v.election && v.election.id && v.election.id.toString() === term) ||
        (v.electionId && v.electionId.toString() === term) ||
        (v.voterName && v.voterName.toLowerCase().includes(term)) ||
        (v.positionName && v.positionName.toLowerCase().includes(term))
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

  deleteVote(id: number): void {
    if (confirm('Are you sure you want to delete this vote?')) {
      this.voteService.delete(id).subscribe({
        next: () => {
          this.votes = this.votes.filter(v => v.id !== id);
          this.applyFilters();
        },
        error: (err: any) => console.error(err)
      });
    }
  }
}
