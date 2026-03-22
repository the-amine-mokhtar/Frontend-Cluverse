import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-applications-kanban',
  templateUrl: './applications-kanban.component.html',
  styleUrl: './applications-kanban.component.scss'
})
export class ApplicationsKanbanComponent implements OnInit {
  campaignId!: number;
  isLoading = true;
  loadError = '';

  // Kanban Columns Data Structure
  columns = [
    { id: 'NEW', title: 'New', colorClass: 'kanban__col--new', items: [] as any[] },
    { id: 'REVIEWING', title: 'Reviewing', colorClass: 'kanban__col--reviewing', items: [] as any[] },
    { id: 'INTERVIEW', title: 'Interview', colorClass: 'kanban__col--interview', items: [] as any[] },
    { id: 'ACCEPTED', title: 'Accepted', colorClass: 'kanban__col--accepted', items: [] as any[] },
    { id: 'REJECTED', title: 'Rejected', colorClass: 'kanban__col--rejected', items: [] as any[] }
  ];

  selectedApp: any = null;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.campaignId = +id;
      this.loadApplications();
    }
  }

  loadApplications(): void {
    this.isLoading = true;
    this.loadError = '';
    this.api.getCampaignApplications(this.campaignId).subscribe({
      next: (apps) => {
        // Reset columns
        this.columns.forEach(c => c.items = []);
        
        // Distribute apps into correct columns by status
        (apps || []).forEach((app: any) => {
          const status = app.status || 'NEW';
          const col = this.columns.find(c => c.id === status);
          if (col) {
            col.items.push(app);
          } else {
            this.columns[0].items.push(app);
          }
        });
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Failed to load applications. Please check your connection and try again.';
        this.isLoading = false;
      }
    });
  }

  // ─── Drag & Drop ──────────────────────────────────────────

  drop(event: CdkDragDrop<any[]>): void {
    if (event.previousContainer === event.container) {
      // Reordering within the same column visually (though status hasn't changed)
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Visually move across columns
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // The dropped item
      const movedApp = event.container.data[event.currentIndex];
      // Get the column ID (which corresponds to Enum string)
      const newStatusStr = event.container.id; 
      
      const previousStatusStr = movedApp.status;
      movedApp.status = newStatusStr;

      // Persist across API
      this.api.updateApplicationStatus(movedApp.id, newStatusStr).subscribe({
        next: () => {
          // Success, backend updated
        },
        error: () => {
          // Rollback visually on error
          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex
          );
          movedApp.status = previousStatusStr; // restore old status prop
          alert('Failed to save status on the server. Change reverted.');
        }
      });
    }
  }

  // ─── Modal ────────────────────────────────────────────────

  openModal(app: any): void {
    this.selectedApp = app;
  }

  closeModal(): void {
    this.selectedApp = null;
  }
}
