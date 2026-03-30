import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { PositionService } from '../../services/position.service';

@Component({
  selector: 'app-position-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule],
  templateUrl: './position-list.component.html',
  styleUrl: './position-list.component.scss'
})
export class PositionListComponent implements OnInit {
  positions: any[] = [];
  filteredPositions: any[] = [];
  
  searchTerm: string = '';
  page: number = 1;
  itemsPerPage: number = 5;
  sortColumn: string = '';
  sortOrder: 'asc' | 'desc' = 'asc';

  constructor(private positionService: PositionService) {}

  ngOnInit(): void {
    this.loadPositions();
  }

  loadPositions(): void {
    this.positionService.getByClubId().subscribe({
      next: (data) => {
        this.positions = data || [];
        this.applyFilters();
      },
      error: (err) => console.error(err)
    });
  }

  applyFilters(): void {
    let result = this.positions;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
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

    this.filteredPositions = result;
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

  deletePosition(id: number): void {
    if (confirm('Delete this position?')) {
      this.positionService.delete(id).subscribe({
        next: () => {
          this.positions = this.positions.filter(p => p.id !== id);
          this.applyFilters();
        },
        error: (err) => console.error(err)
      });
    }
  }
}
