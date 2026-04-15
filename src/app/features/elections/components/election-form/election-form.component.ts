import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ElectionService } from '../../services/election.service';
import { PositionService } from '../../services/position.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-election-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './election-form.component.html',
  styleUrls: ['./election-form.component.scss']
})
export class ElectionFormComponent implements OnInit {
  electionForm!: FormGroup;
  isEditMode = false;
  electionId: number | null = null;
  errorMessage: string = '';
  isSubmitting = false;
  availablePositions: any[] = [];
  clubId: number = 0;

  constructor(
    private fb: FormBuilder,
    private electionService: ElectionService,
    private positionService: PositionService,
    private authHelper: AuthHelperService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.clubId = this.authHelper.getClubId();
    this.initForm();
    this.loadData();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.electionId = +id;
        this.loadElection(this.electionId);
      }
    });
  }

  initForm(): void {
    this.electionForm = this.fb.group({
      title: ['', [Validators.required]],
      description: [''],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      status: ['OPEN', [Validators.required]],
      positionId: [null, [Validators.required]]
    });
  }

  loadData(): void {
    forkJoin({
      positions: this.positionService.getByClubId(this.clubId),
      elections: this.electionService.getElections(this.clubId)
    }).subscribe({
      next: ({ positions, elections }) => {
        const usedPositionIds = new Set(
          elections
            .filter((e: any) => String(e.status || '').toUpperCase() === 'OPEN')
            .map((e: any) => e.position?.id)
            .filter((id: any) => id != null)
        );
        this.availablePositions = positions.filter(
          (p: any) => p.electable && !usedPositionIds.has(p.id)
        );
      },
      error: (err) => console.error('Failed to load data', err)
    });
  }

  loadElection(id: number): void {
    this.electionService.getById(id).subscribe({
      next: (data) => {
        if (data.startDate) {
          data.startDate = new Date(data.startDate).toISOString().slice(0, 10);
        }
        if (data.endDate) {
          data.endDate = new Date(data.endDate).toISOString().slice(0, 10);
        }
        if (data.position && data.position.id) {
          data.positionId = data.position.id;
          const alreadyInList = this.availablePositions.some(p => p.id === data.position.id);
          if (!alreadyInList) {
            this.availablePositions.push(data.position);
          }
        }
        this.electionForm.patchValue(data);
      },
      error: (err) => {
        console.error(err);
        this.router.navigate(['/dashboard/elections/list'], { state: { error: 'Election not found or access forbidden' } });
      }
    });
  }

  onSubmit(): void {
    if (this.electionForm.invalid) {
      this.electionForm.markAllAsTouched();
      return;
    }

    const start = new Date(this.electionForm.value.startDate).getTime();
    const end = new Date(this.electionForm.value.endDate).getTime();
    if (end <= start) {
      this.errorMessage = 'End date must be after Start date.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      ...this.electionForm.value,
      clubId: this.clubId
    };

    const request$ = this.isEditMode
      ? this.electionService.update(this.electionId!, payload)
      : this.electionService.create(payload);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/dashboard/elections/list']);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Action failed.';
        this.isSubmitting = false;
      }
    });
  }
}
