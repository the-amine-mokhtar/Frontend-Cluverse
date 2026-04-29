import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-form-builder',
  templateUrl: './form-builder.component.html',
  styleUrl: './form-builder.component.scss'
})
export class FormBuilderComponent implements OnInit {
  campaignId!: number;
  campaign: any = null;
  questions: any[] = [];
  
  isLoading = true;
  loadError = '';

  // Options
  QUESTION_TYPES = ['TEXT', 'TEXTAREA', 'MULTIPLE_CHOICE', 'FILE', 'DATE', 'YES_NO', 'RATING'];

  // AI Modal State
  showAiModal = false;
  isGenerating = false;
  aiForm = {
    questionCount: 5,
    themes: [] as string[],
    additionalInstructions: ''
  };
  availableThemes = ['Motivation', 'Disponibilité', 'Compétences', 'Expérience', 'Valeurs', 'Objectifs', 'Travail en équipe'];

  toggleTheme(theme: string): void {
    const index = this.aiForm.themes.indexOf(theme);
    if (index >= 0) {
      this.aiForm.themes.splice(index, 1);
    } else {
      this.aiForm.themes.push(theme);
    }
  }

  isThemeSelected(theme: string): boolean {
    return this.aiForm.themes.includes(theme);
  }

  generateWithAI(): void {
    if (this.aiForm.themes.length === 0) return;
    this.isGenerating = true;
    this.api.generateQuestions(this.campaignId, this.aiForm).subscribe({
      next: (questions: any[]) => {
        questions.forEach((q, index) => {
          const newQuestion = {
            label: q.label,
            type: q.type,
            required: q.required,
            options: q.options ? JSON.stringify(q.options) : null,
            orderIndex: this.questions.length + index
          };
          this.api.addQuestion(this.campaignId, newQuestion).subscribe({
            next: (saved) => this.questions.push(saved),
            error: () => {}
          });
        });
        this.isGenerating = false;
        this.showAiModal = false;
        this.aiForm = { questionCount: 5, themes: [], additionalInstructions: '' };
      },
      error: () => { this.isGenerating = false; }
    });
  }

  // Inline Form State
  showForm = false;
  isEditMode = false;
  editingId: number | null = null;
  isSaving = false;
  formError = '';

  formData: any = {
    label: '',
    type: 'TEXT',
    required: false,
    options: '' // Bound to the textarea as comma-separated string
  };

  // Delete State
  confirmTarget: any = null;
  isDeleting = false;
  deleteError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.campaignId = +id;
        this.loadCampaignDetails();
      }
    });
  }

  loadCampaignDetails(): void {
    this.isLoading = true;
    this.api.getCampaign(this.campaignId).subscribe({
      next: (campaign) => {
        this.campaign = campaign;
        // Assume questions are returned inside campaign object. If not, they might be an empty array if unset.
        // We will robustly sort them by orderIndex
        this.questions = (campaign.questions || []).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
        this.isLoading = false;
      },
      error: () => {
        this.loadError = 'Failed to load campaign data.';
        this.isLoading = false;
      }
    });
  }

  // ─── Reordering (Drag and Drop) ──────

  drop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      // Optimistically move the item in the local array
      moveItemInArray(this.questions, event.previousIndex, event.currentIndex);
      
      // Update orderIndex values to reflect the new visually correct array
      this.questions.forEach((q, idx) => {
        q.orderIndex = idx;
      });

      // Issue concurrent PUT requests to the backend with their new indexes
      const requests = this.questions.map(q => {
        return this.api.updateQuestion(q.id, q).toPromise(); 
        // toPromise is used here to fire them off, although parallel RxJS forkJoin is cleaner, 
        // a simple mapped array of promises guarantees them being fired.
      });

      Promise.all(requests).catch(err => {
        console.error("Failed to persist order", err);
        // Could show a toast here if needed
      });
    }
  }

  // ─── Question Inline Form ────────────

  openNewForm(): void {
    this.showForm = true;
    this.isEditMode = false;
    this.editingId = null;
    this.formData = { label: '', type: 'TEXT', required: false, options: '' };
    this.formError = '';
  }

  openEditForm(q: any): void {
    this.showForm = true;
    this.isEditMode = true;
    this.editingId = q.id;
    
    // Parse options from JSON string if available
    let parsedOptions = '';
    if (q.type === 'MULTIPLE_CHOICE' && q.options) {
      try {
        const arr = JSON.parse(q.options);
        parsedOptions = Array.isArray(arr) ? arr.join(', ') : '';
      } catch(e) { /* ignore */ }
    }

    this.formData = {
      label: q.label,
      type: q.type,
      required: q.required,
      options: parsedOptions
    };
    this.formError = '';
  }

  closeForm(): void {
    this.showForm = false;
    this.formError = '';
  }

  isFormValid(): boolean {
    if (!this.formData.label || !this.formData.type) return false;
    if (this.formData.type === 'MULTIPLE_CHOICE' && !this.formData.options.trim()) return false;
    return true;
  }

  onSave(): void {
    if (!this.isFormValid()) return;
    this.isSaving = true;
    this.formError = '';

    // Convert options to JSON string
    let finalOptionsPattern: string | null = null;
    if (this.formData.type === 'MULTIPLE_CHOICE') {
      const arr = this.formData.options.split(',').map((o: string) => o.trim()).filter((o: string) => o.length > 0);
      finalOptionsPattern = JSON.stringify(arr);
    }

    const payload = {
      label: this.formData.label,
      type: this.formData.type,
      required: this.formData.required,
      options: finalOptionsPattern,
      orderIndex: this.isEditMode && this.editingId 
                  ? this.questions.find(q => q.id === this.editingId)?.orderIndex 
                  : this.questions.length // put at the end if new
    };

    if (this.isEditMode && this.editingId) {
      this.api.updateQuestion(this.editingId, payload).subscribe({
        next: (updated) => {
          const idx = this.questions.findIndex(q => q.id === this.editingId);
          if (idx !== -1) {
            // retain ID from response or fallback to what we targeted
            this.questions[idx] = updated; 
          }
          this.isSaving = false;
          this.closeForm();
        },
        error: (err: HttpErrorResponse) => {
          this.formError = 'Failed to update question.';
          this.isSaving = false;
        }
      });
    } else {
      this.api.addQuestion(this.campaignId, payload).subscribe({
        next: (created) => {
          this.questions.push(created);
          this.isSaving = false;
          this.closeForm();
        },
        error: () => {
          this.formError = 'Failed to add question.';
          this.isSaving = false;
        }
      });
    }
  }

  // ─── Delete Actions ──────────────────

  openConfirm(q: any): void {
    this.confirmTarget = q;
    this.deleteError = '';
  }

  closeConfirm(): void {
    this.confirmTarget = null;
  }

  onConfirmDelete(): void {
    if (!this.confirmTarget) return;
    this.isDeleting = true;
    this.deleteError = '';

    this.api.deleteQuestion(this.confirmTarget.id).subscribe({
      next: () => {
        this.questions = this.questions.filter(q => q.id !== this.confirmTarget.id);
        
        // Fix up the order locally, ignoring firing updates for now to save network calls
        this.questions.forEach((q, idx) => q.orderIndex = idx);

        this.isDeleting = false;
        this.closeConfirm();
      },
      error: () => {
        this.deleteError = 'Failed to delete question.';
        this.isDeleting = false;
      }
    });
  }

  // ─── Type Formatter Helper ──────────────
  formatTypeLabel(str: string): string {
    return (str || '').replace(/_/g, ' ');
  }
}
