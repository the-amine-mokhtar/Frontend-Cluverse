import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  ApiService,
  CompetencyCategory,
  CompetencyRequest,
  CompetencyResponse
} from '../../../../core/services/api.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';

@Component({
  selector: 'app-competencies-home',
  templateUrl: './competencies-home.component.html',
  styleUrls: ['./competencies-home.component.scss']
})
export class CompetenciesHomeComponent implements OnInit {
  readonly categories: CompetencyCategory[] = ['TECHNICAL', 'HARD', 'SOFT'];
  readonly categoryFilters: Array<'ALL' | CompetencyCategory> = ['ALL', 'TECHNICAL', 'HARD', 'SOFT'];

  competencies: CompetencyResponse[] = [];
  selectedCategory: 'ALL' | CompetencyCategory = 'ALL';
  searchTerm = '';
  clubId = 0;
  loading = false;
  submitting = false;
  editingId: number | null = null;
  errorMessage = '';
  successMessage = '';

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    category: this.fb.nonNullable.control<CompetencyCategory>('TECHNICAL', Validators.required)
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authHelperService: AuthHelperService
  ) {}

  ngOnInit(): void {
    this.clubId = this.authHelperService.getClubId();
    if (!this.clubId) {
      this.errorMessage = 'Club introuvable. Reconnecte-toi puis reessaie.';
      return;
    }
    this.loadCompetencies();
  }

  get isEditing(): boolean {
    return this.editingId !== null;
  }

  get nameControl() {
    return this.form.controls.name;
  }

  get filteredCompetencies(): CompetencyResponse[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.competencies.filter((item) => {
      const categoryMatches = this.selectedCategory === 'ALL' || item.category === this.selectedCategory;
      const textMatches = !search
        || item.name.toLowerCase().includes(search)
        || (item.description ?? '').toLowerCase().includes(search);
      return categoryMatches && textMatches;
    });
  }

  get technicalCount(): number {
    return this.competencies.filter(c => c.category === 'TECHNICAL').length;
  }

  get hardCount(): number {
    return this.competencies.filter(c => c.category === 'HARD').length;
  }

  get softCount(): number {
    return this.competencies.filter(c => c.category === 'SOFT').length;
  }

  get categoryBreakdown(): Array<{ category: CompetencyCategory; label: string; count: number; percent: number }> {
    const total = Math.max(this.competencies.length, 1);

    return [
      {
        category: 'TECHNICAL',
        label: 'Technical',
        count: this.technicalCount,
        percent: Math.round((this.technicalCount / total) * 100)
      },
      {
        category: 'HARD',
        label: 'Hard',
        count: this.hardCount,
        percent: Math.round((this.hardCount / total) * 100)
      },
      {
        category: 'SOFT',
        label: 'Soft',
        count: this.softCount,
        percent: Math.round((this.softCount / total) * 100)
      }
    ];
  }

  loadCompetencies(): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService.getCompetencies(this.clubId).subscribe({
      next: (items) => {
        this.competencies = items;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les competencies.';
        this.loading = false;
      }
    });
  }

  submit(): void {
    if (this.form.invalid || !this.clubId) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: CompetencyRequest = {
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
      category: this.form.controls.category.value,
      clubId: this.clubId
    };

    const request$ = this.editingId === null
      ? this.apiService.createCompetency(payload)
      : this.apiService.updateCompetency(this.editingId, payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditing ? 'Competency mise a jour.' : 'Competency ajoutee.';
        this.cancelEdit();
        this.loadCompetencies();
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = this.isEditing
          ? 'La mise a jour a echoue.'
          : 'La creation a echoue.';
      }
    });
  }

  edit(item: CompetencyResponse): void {
    this.editingId = item.id;
    this.successMessage = '';
    this.errorMessage = '';
    this.form.setValue({
      name: item.name,
      description: item.description ?? '',
      category: item.category
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form.reset({
      name: '',
      description: '',
      category: 'TECHNICAL'
    });
  }

  delete(item: CompetencyResponse): void {
    const confirmed = window.confirm(`Supprimer la competency "${item.name}" ?`);
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.apiService.deleteCompetency(item.id).subscribe({
      next: () => {
        this.successMessage = 'Competency supprimee.';
        this.competencies = this.competencies.filter(c => c.id !== item.id);
      },
      error: () => {
        this.errorMessage = 'Suppression impossible.';
      }
    });
  }

  setCategoryFilter(filter: 'ALL' | CompetencyCategory): void {
    this.selectedCategory = filter;
  }

  categoryLabel(category: CompetencyCategory): string {
    if (category === 'TECHNICAL') return 'Technical';
    if (category === 'HARD') return 'Hard';
    return 'Soft';
  }

  categoryCssClass(category: CompetencyCategory): string {
    return `badge badge--${category.toLowerCase()}`;
  }

  trackById(_: number, item: CompetencyResponse): number {
    return item.id;
  }
}
