import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CandidateService } from '../../services/candidate.service';
import { ElectionService } from '../../services/election.service';
import { PositionService } from '../../services/position.service';

@Component({
  selector: 'app-candidate-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './candidate-form.component.html',
  styleUrls: ['./candidate-form.component.scss']
})
export class CandidateFormComponent implements OnInit {
  candidateForm!: FormGroup;
  isEditMode = false;
  candidateId: number | null = null;
  errorMessage: string = '';
  isSubmitting = false;
  elections: any[] = [];
  positions: any[] = [];

  constructor(
    private fb: FormBuilder,
    private candidateService: CandidateService,
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
        this.candidateId = +id;
        this.loadCandidate(this.candidateId);
      }
    });
  }

  initForm(): void {
    this.candidateForm = this.fb.group({
      positionId: [null, [Validators.required, Validators.min(1)]],
      electionId: [null, [Validators.required, Validators.min(1)]],
      program: ['', [Validators.required]],
      bio: ['']
    });
  }

  loadData(): void {
    this.electionService.getElections().subscribe({
      next: (data) => this.elections = data,
      error: (err) => console.error('Failed to load elections', err)
    });
    this.positionService.getByClubId().subscribe({
      next: (data) => this.positions = data,
      error: (err) => console.error('Failed to load positions', err)
    });
  }

  loadCandidate(id: number): void {
    this.candidateService.getById(id).subscribe({
      next: (data) => {
        this.candidateForm.patchValue({
          positionId: data.positionId || null,
          electionId: data.electionId || null,
          program: data.program || '',
          bio: data.bio || ''
        });
      },
      error: (err) => {
        console.error(err);
        this.router.navigate(['/dashboard/elections/candidates'], { state: { error: 'Candidate not found or access forbidden' } });
      }
    });
  }

  onSubmit(): void {
    if (this.candidateForm.invalid) {
      this.candidateForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = { ...this.candidateForm.value };
    
    // Note: create uses submitCandidacy. It takes payload.
    const requestArgs = this.isEditMode 
      ? this.candidateService.update(this.candidateId!, payload)
      : this.candidateService.submitCandidacy(payload);

    requestArgs.subscribe({
      next: () => {
        this.router.navigate(['/dashboard/elections/candidates']);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Action failed.';
        this.isSubmitting = false;
      }
    });
  }
}
