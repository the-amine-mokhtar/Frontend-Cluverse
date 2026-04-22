import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PositionService } from '../../services/position.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-position-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './position-form.component.html',
  styleUrls: ['./position-form.component.scss']
})
export class PositionFormComponent implements OnInit {
  positionForm!: FormGroup;
  isEditMode = false;
  positionId: number | null = null;
  errorMessage: string = '';
  isSubmitting = false;
  clubId: number = 0;
  members: any[] = [];

  constructor(
    private fb: FormBuilder,
    private positionService: PositionService,
    private authHelper: AuthHelperService,
    private apiService: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.clubId = this.authHelper.getClubId();
    this.initForm();
    this.loadMembers();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.positionId = +id;
        this.loadPosition(this.positionId);
      }
    });
  }

  initForm(): void {
    this.positionForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      termLength: [1, [Validators.required, Validators.min(1)]],
      maxCandidates: [2, [Validators.required, Validators.min(1)]],
      isElectable: [true],
      isAutoRenew: [false],
      currentHolderId: [null]
    });
  }

  loadMembers(): void {
    if (!this.clubId) return;
    this.apiService.getClubMembers(this.clubId).subscribe({
      next: (data) => this.members = data || [],
      error: (err) => console.error('Failed to load members', err)
    });
  }

  loadPosition(id: number): void {
    this.positionService.getById(id).subscribe({
      next: (data) => {
        this.positionForm.patchValue({
          name: data.name,
          description: data.description,
          termLength: data.termLength,
          maxCandidates: data.maxCandidates,
          isElectable: data.electable,
          isAutoRenew: data.autoRenew,
          currentHolderId: data.currentHolderId || null
        });
      },
      error: (err) => {
        console.error(err);
        this.router.navigate(['/dashboard/elections/positions-list'], { state: { error: 'Position not found or access forbidden' } });
      }
    });
  }

  onSubmit(): void {
    if (this.positionForm.invalid) {
      this.positionForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const formValues = this.positionForm.value;
    const isElectable = !!formValues.isElectable;
    
    const payload = {
      ...formValues,
      electable: isElectable,
      autoRenew: isElectable ? formValues.isAutoRenew : null,
      termLength: isElectable ? formValues.termLength : null,
      maxCandidates: isElectable ? formValues.maxCandidates : null,
      clubId: this.clubId
    };

    delete (payload as any).isElectable;
    delete (payload as any).isAutoRenew;

    const request$ = this.isEditMode
      ? this.positionService.update(this.positionId!, payload)
      : this.positionService.create(payload);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/dashboard/elections/positions-list']);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Action failed.';
        this.isSubmitting = false;
      }
    });
  }
}
