import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ElectionService } from '../../services/election.service';
import { PositionService } from '../../services/position.service';

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
  positions: any[] = [];

  constructor(
    private fb: FormBuilder,
    private electionService: ElectionService,
    private positionService: PositionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
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
      status: ['PENDING', [Validators.required]],
      positionId: [null],
      clubId: [null]
    });
  }

  loadData(): void {
    this.positionService.getByClubId().subscribe({
      next: (data) => this.positions = data,
      error: (err) => console.error('Failed to load positions', err)
    });
  }

  loadElection(id: number): void {
    this.electionService.getById(id).subscribe({
      next: (data) => {
        if (data.startDate) {
          data.startDate = new Date(data.startDate).toISOString().slice(0, 16);
        }
        if (data.endDate) {
          data.endDate = new Date(data.endDate).toISOString().slice(0, 16);
        }
        if (data.position && data.position.id) {
           data.positionId = data.position.id;
        }
        if (data.club && data.club.id) {
           data.clubId = data.club.id;
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

    const payload = { ...this.electionForm.value };
    
    const requestArgs = this.isEditMode 
      ? this.electionService.update(this.electionId!, payload)
      : this.electionService.create(payload);

    requestArgs.subscribe({
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
