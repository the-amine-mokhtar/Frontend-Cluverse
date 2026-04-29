import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ApiService,
  CompetencyCategory,
  CompetencyBulkImportResponse,
  CompetencyCloneRequest,
  CompetencyRequest,
  CompetencyResponse,
  CompetencyStatsResponse,
  MemberCompetencyResponse,
  MemberCompetencyUpdateRequest
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

  // ── Catalog state ──────────────────────────────────────────────────────────
  competencies: CompetencyResponse[] = [];
  stats: CompetencyStatsResponse | null = null;
  selectedCategory: 'ALL' | CompetencyCategory = 'ALL';
  private _searchTerm = '';
  get searchTerm(): string { return this._searchTerm; }
  set searchTerm(value: string) { this._searchTerm = value; this.currentPage = 1; }
  clubId = 0;
  targetClubId = 0;
  loading = false;
  currentPage = 1;
  readonly pageSize = 5;
  submitting = false;
  importing = false;
  cloningId: number | null = null;
  editingId: number | null = null;
  isSuperAdmin = false;
  errorMessage = '';
  successMessage = '';
  bulkImportFileName = '';

  // ── Assignment state ───────────────────────────────────────────────────────
  assignDialogOpen = false;
  members: any[] = [];
  membersLoading = false;
  selectedMemberIds = new Set<number>();
  assignCompetencyId: number | null = null;
  assignCurrentLevel = 1;
  assignTargetLevel = 3;
  assignSubmitting = false;
  assignError = '';
  assignSuccess = '';

  memberAssignments: MemberCompetencyResponse[] = [];
  assignmentsLoading = false;
  removingAssignmentId: number | null = null;

  editingAssignment: MemberCompetencyResponse | null = null;
  editAssignCurrentLevel = 1;
  editAssignTargetLevel = 3;
  editAssignSubmitting = false;
  editAssignError = '';

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
    this.isSuperAdmin = this.authHelperService.isSuperAdmin();
    this.clubId = this.authHelperService.getClubId();
    if (!this.clubId) {
      this.errorMessage = 'Club not found. Reconnect and try again.';
      return;
    }
    this.loadCompetencies();
    this.loadAssignments();
  }

  // ── Catalog helpers ────────────────────────────────────────────────────────

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

  get pagedCompetencies(): CompetencyResponse[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCompetencies.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCompetencies.length / this.pageSize));
  }

  get pageStart(): number {
    return this.filteredCompetencies.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredCompetencies.length);
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
      { category: 'TECHNICAL', label: 'Technical', count: this.technicalCount, percent: Math.round((this.technicalCount / total) * 100) },
      { category: 'HARD',      label: 'Hard',      count: this.hardCount,      percent: Math.round((this.hardCount / total) * 100) },
      { category: 'SOFT',      label: 'Soft',      count: this.softCount,      percent: Math.round((this.softCount / total) * 100) }
    ];
  }

  loadCompetencies(): void {
    this.loading = true;
    this.errorMessage = '';
    this.apiService.getCompetencies(this.clubId).subscribe({
      next: (items) => {
        this.competencies = items;
        this.loadStats();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load competencies.';
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.apiService.getCompetencyStats(this.clubId).subscribe({
      next: (stats) => { this.stats = stats; },
      error: () => { this.stats = null; }
    });
  }

  handleBulkImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !this.clubId) return;

    this.importing = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.bulkImportFileName = file.name;

    this.apiService.uploadCompetencyBulkImport(this.clubId, file).subscribe({
      next: (response: CompetencyBulkImportResponse) => {
        this.importing = false;
        this.bulkImportFileName = '';
        this.successMessage = `Import finished: ${response.createdCount} created, ${response.skippedCount} skipped.`;
        this.loadCompetencies();
      },
      error: () => {
        this.importing = false;
        this.bulkImportFileName = '';
        this.errorMessage = 'CSV import failed.';
      }
    });
  }

  cloneCompetency(item: CompetencyResponse): void {
    if (!this.isSuperAdmin) return;
    if (!this.targetClubId || this.targetClubId <= 0) {
      this.errorMessage = 'Provide a valid target club before cloning.';
      return;
    }
    this.cloningId = item.id;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: CompetencyCloneRequest = { targetClubId: this.targetClubId };
    this.apiService.cloneCompetency(item.id, payload).subscribe({
      next: () => {
        this.cloningId = null;
        this.successMessage = `Competency cloned to club ${this.targetClubId}.`;
        this.loadCompetencies();
      },
      error: () => {
        this.cloningId = null;
        this.errorMessage = 'Cloning failed.';
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
        this.successMessage = this.isEditing ? 'Competency updated.' : 'Competency added.';
        this.cancelEdit();
        this.loadCompetencies();
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = this.isEditing ? 'Update failed.' : 'Creation failed.';
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
    this.form.reset({ name: '', description: '', category: 'TECHNICAL' });
  }

  delete(item: CompetencyResponse): void {
    const confirmed = window.confirm(`Delete competency "${item.name}"?`);
    if (!confirmed) return;

    this.errorMessage = '';
    this.successMessage = '';
    this.apiService.deleteCompetency(item.id).subscribe({
      next: () => {
        this.successMessage = 'Competency deleted.';
        this.competencies = this.competencies.filter(c => c.id !== item.id);
        this.loadStats();
      },
      error: () => {
        this.errorMessage = 'Deletion failed.';
      }
    });
  }

  setCategoryFilter(filter: 'ALL' | CompetencyCategory): void {
    this.selectedCategory = filter;
    this.currentPage = 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
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

  trackByStatCategory(_: number, item: { category: CompetencyCategory }): CompetencyCategory {
    return item.category;
  }

  // ── Assignment helpers ─────────────────────────────────────────────────────

  loadAssignments(): void {
    this.assignmentsLoading = true;
    this.apiService.getMemberCompetenciesByClub(this.clubId).subscribe({
      next: (data) => {
        this.memberAssignments = data;
        this.assignmentsLoading = false;
      },
      error: () => {
        this.assignmentsLoading = false;
      }
    });
  }

  openAssignDialog(): void {
    this.assignError = '';
    this.assignSuccess = '';
    this.assignCompetencyId = this.competencies[0]?.id ?? null;
    this.assignCurrentLevel = 1;
    this.assignTargetLevel = 3;
    this.selectedMemberIds.clear();
    this.assignDialogOpen = true;

    if (this.members.length === 0) {
      this.membersLoading = true;
      this.apiService.getClubMembers(this.clubId).subscribe({
        next: (data) => { this.members = data; this.membersLoading = false; },
        error: () => { this.membersLoading = false; }
      });
    }
  }

  closeAssignDialog(): void {
    this.assignDialogOpen = false;
  }

  toggleMember(id: number): void {
    if (this.selectedMemberIds.has(id)) {
      this.selectedMemberIds.delete(id);
    } else {
      this.selectedMemberIds.add(id);
    }
  }

  isMemberSelected(id: number): boolean {
    return this.selectedMemberIds.has(id);
  }

  get selectedMemberCount(): number {
    return this.selectedMemberIds.size;
  }

  submitAssignment(): void {
    if (!this.assignCompetencyId || this.selectedMemberIds.size === 0) {
      this.assignError = 'Select a competency and at least one member.';
      return;
    }
    if (this.assignCurrentLevel < 0 || this.assignCurrentLevel > 5 ||
        this.assignTargetLevel < 0 || this.assignTargetLevel > 5) {
      this.assignError = 'Levels must be between 0 and 5.';
      return;
    }

    this.assignSubmitting = true;
    this.assignError = '';
    this.assignSuccess = '';

    const requests = Array.from(this.selectedMemberIds).map(userId =>
      this.apiService.assignCompetency({
        userId,
        skillId: this.assignCompetencyId!,
        competencyId: this.assignCompetencyId!,
        currentLevel: this.assignCurrentLevel,
        targetLevel: this.assignTargetLevel,
        lastUpdatedBy: 'MANUAL'
      }).pipe(catchError((err) => {
        console.error('Assignment failed for userId', userId, err);
        return of(null);
      }))
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const successes = results.filter(r => r !== null).length;
        const failures = results.length - successes;
        this.assignSubmitting = false;

        if (successes === 0) {
          this.assignError = `❌ All ${failures} assignment(s) failed. The member may already have this competency assigned, or check the console for details.`;
        } else if (failures === 0) {
          this.assignSuccess = `✓ ${successes} assignment(s) created successfully.`;
          this.assignDialogOpen = false;
          this.loadAssignments();
          this.loadStats();
        } else {
          this.assignError = `⚠ ${successes} succeeded, ${failures} failed (already assigned or server error).`;
          this.loadAssignments();
          this.loadStats();
        }
      },
      error: () => {
        this.assignSubmitting = false;
        this.assignError = 'An error occurred during assignment.';
      }
    });
  }

  removeAssignment(id: number): void {
    const confirmed = window.confirm('Remove this assignment?');
    if (!confirmed) return;

    this.removingAssignmentId = id;
    this.apiService.deleteMemberCompetency(id).subscribe({
      next: () => {
        this.removingAssignmentId = null;
        this.memberAssignments = this.memberAssignments.filter(a => a.id !== id);
        this.loadStats();
      },
      error: () => {
        this.removingAssignmentId = null;
      }
    });
  }

  openEditAssignment(assignment: MemberCompetencyResponse): void {
    this.editingAssignment = assignment;
    this.editAssignCurrentLevel = assignment.currentLevel;
    this.editAssignTargetLevel = assignment.targetLevel;
    this.editAssignError = '';
    this.editAssignSubmitting = false;
  }

  closeEditAssignment(): void {
    this.editingAssignment = null;
    this.editAssignError = '';
  }

  submitEditAssignment(): void {
    if (!this.editingAssignment) return;
    if (this.editAssignCurrentLevel < 0 || this.editAssignCurrentLevel > 5 ||
        this.editAssignTargetLevel < 0 || this.editAssignTargetLevel > 5) {
      this.editAssignError = 'Levels must be between 0 and 5.';
      return;
    }

    this.editAssignSubmitting = true;
    this.editAssignError = '';

    const payload: MemberCompetencyUpdateRequest = {
      currentLevel: this.editAssignCurrentLevel,
      targetLevel: this.editAssignTargetLevel,
      lastUpdatedBy: 'MANUAL'
    };

    this.apiService.updateMemberCompetency(this.editingAssignment.id, payload).subscribe({
      next: (updated) => {
        this.editAssignSubmitting = false;
        const idx = this.memberAssignments.findIndex(a => a.id === updated.id);
        if (idx !== -1) this.memberAssignments[idx] = updated;
        this.closeEditAssignment();
        this.loadStats();
      },
      error: () => {
        this.editAssignSubmitting = false;
        this.editAssignError = 'Update failed.';
      }
    });
  }

  gapClass(gap: number): string {
    if (gap <= 0) return 'gap-ok';
    if (gap <= 2) return 'gap-warn';
    return 'gap-danger';
  }

  levelLabel(level: number): string {
    const labels = ['None', 'Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
    return labels[Math.max(0, Math.min(5, level))] ?? String(level);
  }

  trackByAssignmentId(_: number, item: MemberCompetencyResponse): number {
    return item.id;
  }

  trackByMemberId(_: number, m: any): number {
    return m.id ?? m.userId;
  }

  // Category icon helper - returns SVG path for each category
  getCategoryIconSvg(category: string): string {
    const icons: Record<string, string> = {
      'SOFT': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
      'HARD': 'M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm14 0v-6.7l-6 3.37v6.71l6-3.38z',
      'TECHNICAL': 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z'
    };
    return icons[category] || icons['SOFT'];
  }

  // Category color helper - returns color for each category
  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'SOFT': '#3b82f6',
      'HARD': '#f59e0b',
      'TECHNICAL': '#10b981'
    };
    return colors[category] || '#64748b';
  }
}
