import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { VoteService } from '../../services/vote.service';
import { ElectionService } from '../../services/election.service';
import { CandidateService } from '../../services/candidate.service';

@Component({
  selector: 'app-vote-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './vote-form.component.html',
  styleUrls: ['./vote-form.component.scss']
})
export class VoteFormComponent implements OnInit {
  voteForm!: FormGroup;
  isEditMode = false;
  voteId: number | null = null;
  errorMessage: string = '';
  isSubmitting = false;
  elections: any[] = [];
  candidates: any[] = [];

  constructor(
    private fb: FormBuilder,
    private voteService: VoteService,
    private electionService: ElectionService,
    private candidateService: CandidateService,
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
        this.voteId = +id;
        this.loadVote(this.voteId);
      }
    });
  }

  initForm(): void {
    this.voteForm = this.fb.group({
      candidateId: [null, [Validators.required, Validators.min(1)]],
      electionId: [null, [Validators.required, Validators.min(1)]],
    });
  }

  loadData(): void {
    this.electionService.getElections().subscribe({
      next: (data) => this.elections = data,
      error: (err) => console.error('Failed to load elections', err)
    });
    this.candidateService.getCandidates().subscribe({
      next: (data) => this.candidates = data,
      error: (err) => console.error('Failed to load candidates', err)
    });
  }

  loadVote(id: number): void {
    this.voteService.getById(id).subscribe({
      next: (data) => {
        this.voteForm.patchValue({
          candidateId: data.candidate && data.candidate.id ? data.candidate.id : null,
          electionId: data.electionId || null
        });
      },
      error: (err) => {
        console.error(err);
        this.router.navigate(['/dashboard/elections/votes'], { state: { error: 'Vote not found or access forbidden' } });
      }
    });
  }

  onSubmit(): void {
    if (this.voteForm.invalid) {
      this.voteForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = { ...this.voteForm.value };
    
    const requestArgs = this.isEditMode 
      ? this.voteService.update(this.voteId!, payload)
      : this.voteService.castVote(payload);

    requestArgs.subscribe({
      next: () => {
        this.router.navigate(['/dashboard/elections/votes']);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = err.error?.message || 'Action failed.';
        this.isSubmitting = false;
      }
    });
  }
}
