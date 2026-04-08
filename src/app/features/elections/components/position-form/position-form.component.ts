import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PositionService } from '../../services/position.service';

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

  constructor(
    private fb: FormBuilder,
    private positionService: PositionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
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
      clubId: [null],
      currentHolderId: [null]
    });
  }

  loadPosition(id: number): void {
    this.positionService.getById(id).subscribe({
      next: (data) => {
        // Map backend DTO field defaults
        this.positionForm.patchValue({
          name: data.name,
          description: data.description,
          termLength: data.termLength,
          maxCandidates: data.maxCandidates,
          isElectable: data.isElectable !== undefined ? data.isElectable : true,
          isAutoRenew: data.isAutoRenew !== undefined ? data.isAutoRenew : false,
          clubId: data.clubId || null,
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

    const payload = { ...this.positionForm.value };
    
    const requestArgs = this.isEditMode 
      ? this.positionService.update(this.positionId!, payload)
      : this.positionService.create(payload);

    requestArgs.subscribe({
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
