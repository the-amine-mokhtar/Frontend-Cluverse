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
  stats: any = null;
  campaignTitle = '';
  toastMessage = '';
  csvError = '';

  // Properties for interview modal
  showInterviewModal = false;
  pendingInterviewApp: any = null;
  pendingInterviewEvent: CdkDragDrop<any[]> | null = null;
  interviewForm = {
    duration: 30,
    level: 'junior',
    interviewType: 'Motivation',
    presidentNotes: ''
  };
  isSubmittingInterview = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.campaignId = +id;
      this.loadApplications();
      this.loadStats();
    }
  }

  loadStats(): void {
    this.api.getCampaignStats(this.campaignId).subscribe({
      next: (data) => {
        this.stats = data;
      },
      error: () => { this.stats = null; }
    });
  }

  exportCSV(): void {
    if (!this.campaignId) return;
    this.csvError = '';
    this.api.exportApplicationsCSV(this.campaignId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const rootName = this.campaignTitle ? this.campaignTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'campagne';
        a.download = `candidatures-${rootName}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.csvError = 'Export endpoint unavailable';
        setTimeout(() => this.csvError = '', 3000);
      }
    });
  }

  showToast(): void {
    this.toastMessage = 'Statut mis à jour';
    setTimeout(() => this.toastMessage = '', 3000);
  }

  loadApplications(): void {
    this.isLoading = true;
    this.loadError = '';
    this.api.getCampaignApplications(this.campaignId).subscribe({
      next: (apps) => {
        if (apps && apps.length > 0 && apps[0].recruitmentCampaign?.title) {
          this.campaignTitle = apps[0].recruitmentCampaign.title;
        } else {
          this.campaignTitle = 'Campagne';
        }

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
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const newStatusStr = event.container.id;
    if (newStatusStr === 'INTERVIEW') {
      // Stocker l'event et afficher le modal
      this.pendingInterviewEvent = event;
      this.pendingInterviewApp = event.previousContainer.data[event.previousIndex];
      this.showInterviewModal = true;
      return;
    }
    // Comportement normal pour les autres colonnes
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    const movedApp = event.container.data[event.currentIndex];
    const previousStatusStr = movedApp.status;
    movedApp.status = newStatusStr;
    this.api.updateApplicationStatus(movedApp.id, newStatusStr).subscribe({
      next: () => { this.showToast(); this.loadStats(); },
      error: () => {
        transferArrayItem(event.container.data, event.previousContainer.data, event.currentIndex, event.previousIndex);
        movedApp.status = previousStatusStr;
        alert('Failed to save status on the server. Change reverted.');
      }
    });
  }

  confirmInterview(): void {
    if (!this.pendingInterviewEvent || !this.pendingInterviewApp) return;
    this.isSubmittingInterview = true;
    const event = this.pendingInterviewEvent;
    const app = this.pendingInterviewApp;
    this.api.passToInterview(app.id, this.interviewForm).subscribe({
      next: () => {
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex
        );
        const movedApp = event.container.data[event.currentIndex];
        movedApp.status = 'INTERVIEW';
        this.showInterviewModal = false;
        this.pendingInterviewEvent = null;
        this.pendingInterviewApp = null;
        this.isSubmittingInterview = false;
        this.showToast();
        this.loadStats();
      },
      error: () => {
        this.isSubmittingInterview = false;
        alert('Erreur lors du passage en entretien.');
      }
    });
  }

  cancelInterview(): void {
    this.showInterviewModal = false;
    this.pendingInterviewEvent = null;
    this.pendingInterviewApp = null;
  }

  // ─── Modal ────────────────────────────────────────────────

  openModal(app: any): void {
    this.selectedApp = app;
  }

  closeModal(): void {
    this.selectedApp = null;
  }
}
