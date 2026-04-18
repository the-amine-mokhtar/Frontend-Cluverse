import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CandidateService } from '../../services/candidate.service';
import { ElectionService } from '../../services/election.service';
import { AuthHelperService } from '../../../../core/services/auth-helper.service';
import * as pdfjsLib from 'pdfjs-dist';

@Component({
  selector: 'app-candidate-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './candidate-form.component.html',
  styleUrls: ['./candidate-form.component.scss']
})
export class CandidateFormComponent implements OnInit {
  @ViewChild('pdfInput') pdfInputRef?: ElementRef<HTMLInputElement>;
  candidateForm!: FormGroup;
  isEditMode = false;
  candidateId: number | null = null;
  errorMessage: string = '';
  isSubmitting = false;
  elections: any[] = [];
  selectedElection: any = null;
  candidateCount: number = 0;
  lockedElectionTitle = '';
  pdfGenerationError = '';
  isExtractingPdf = false;

  extractionStatus: string = '';

  constructor(
    private fb: FormBuilder,
    private candidateService: CandidateService,
    private electionService: ElectionService,
    private authHelper: AuthHelperService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadElections();
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
      electionId: [null, [Validators.required]],
      program: ['', [Validators.required]],
      bio: ['']
    });

    this.candidateForm.get('electionId')!.valueChanges.subscribe(electionId => {
      this.onElectionChanged(electionId);
    });
  }

  loadElections(): void {
    const clubId = this.authHelper.getClubId();
    this.electionService.getElections(clubId).subscribe({
      next: (data) => {
        this.elections = data.filter((e: any) => e.status === 'OPEN');
        const currentElectionId = this.candidateForm.get('electionId')?.value;
        if (this.isEditMode && currentElectionId) {
          this.onElectionChanged(currentElectionId);
        }
      },
      error: (err) => console.error('Failed to load elections', err)
    });
  }

  onElectionChanged(electionId: number): void {
    if (!electionId) {
      this.selectedElection = null;
      this.candidateCount = 0;
      return;
    }
    this.selectedElection = this.elections.find(e => e.id === electionId) || null;
    this.candidateService.getCandidates(electionId).subscribe({
      next: (candidates) => this.candidateCount = candidates.length,
      error: () => this.candidateCount = 0
    });
  }

  loadCandidate(id: number): void {
    this.candidateService.getById(id).subscribe({
      next: (data) => {
        this.candidateForm.patchValue({
          electionId: data.electionId || null,
          program: data.program || '',
          bio: data.bio || ''
        });
        this.lockedElectionTitle = data.electionTitle || data.election?.title || '';
        if (data.electionId) {
          this.onElectionChanged(data.electionId);
        }
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

    const electionId = this.isEditMode
      ? (this.candidateForm.get('electionId')?.value || null)
      : this.candidateForm.value.electionId;
    const positionId = this.selectedElection?.position?.id || null;
    const payload = {
      ...this.candidateForm.value,
      electionId,
      positionId
    };

    const request$ = this.isEditMode
      ? this.candidateService.update(this.candidateId!, payload)
      : this.candidateService.submitCandidacy(payload);

    request$.subscribe({
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

  openPdfPicker(): void {
    if (this.isExtractingPdf) {
      return;
    }
    this.pdfGenerationError = '';
    this.pdfInputRef?.nativeElement.click();
  }

  async onPdfSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    input.value = '';
    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.pdfGenerationError = 'Please select a valid PDF file.';
      return;
    }

    this.isExtractingPdf = true;
    this.pdfGenerationError = '';
    this.extractionStatus = 'Extracting text from PDF...';

    try {
      const extractedText = await this.extractTextFromPdf(file);
      if (!extractedText.trim()) {
        this.pdfGenerationError = 'No text could be extracted from this PDF.';
        return;
      }

      this.extractionStatus = 'Generating AI bio (may take a moment)...';
      const generated = await firstValueFrom(
        this.candidateService.generateBio({
          extractedText,
          position: this.selectedElection?.position?.name || ''
        })
      );
      this.candidateForm.patchValue({ bio: generated.bio || '' });
      this.candidateForm.get('bio')?.markAsDirty();
      this.candidateForm.get('bio')?.markAsTouched();
    } catch (err: any) {
      console.error('Bio generation error:', err);
      this.pdfGenerationError = 'PDF analysis or bio generation failed. Check if the bio service is running.';
    } finally {
      this.isExtractingPdf = false;
      this.extractionStatus = '';
    }
  }

  private async extractTextFromPdf(file: File): Promise<string> {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter((value: string) => value.trim().length > 0)
        .join(' ');
      if (pageText) {
        pages.push(pageText);
      }
    }

    return pages.join('\n').replace(/\s+/g, ' ').trim();
  }
}
