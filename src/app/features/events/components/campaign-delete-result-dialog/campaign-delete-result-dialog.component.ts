import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { trigger, transition, style, animate } from '@angular/animations';

export interface DeleteCampaignResult {
  action: string;
  message?: string;
  eventsCount?: number;
  participantsCount?: number;
}

@Component({
  selector: 'app-campaign-delete-result-dialog',
  template: `
    <div class="delete-result-dialog" [@slideInUp]>
      <div class="dialog-header" [ngClass]="data.action.toLowerCase()">
        <div class="icon-wrapper" [@scaleIn]>
          <mat-icon class="result-icon" [@pulse]="animateIcon">{{ getIcon() }}</mat-icon>
        </div>
        <h2 mat-dialog-title>{{ getTitle() }}</h2>
      </div>

      <mat-dialog-content>
        <div class="result-content">
          <p class="result-message">{{ data.message || getDefaultMessage() }}</p>

          <div *ngIf="data.action === 'LOCKED'" class="locked-details" [@slideInUp]>
            <div class="detail-header">
              <mat-icon>info</mat-icon>
              <span>Détails du verrouillage</span>
            </div>
            <div class="detail-item">
              <mat-icon>event</mat-icon>
              <span class="detail-label">Événements actifs:</span>
              <span class="detail-value">{{ data.eventsCount || 0 }}</span>
            </div>
            <div class="detail-item">
              <mat-icon>people</mat-icon>
              <span class="detail-label">Participants inscrits:</span>
<span class="detail-value">{{ data.participantsCount || 0 }}</span>
            </div>
            <div class="locked-actions">
              <p class="action-hint">📌 La campagne reste accessible en lecture seule</p>
            </div>
          </div>

          <div *ngIf="data.action === 'ARCHIVED'" class="archived-details" [@slideInUp]>
            <div class="detail-header">
              <mat-icon>archive</mat-icon>
              <span>Campagne archivée</span>
            </div>
            <div class="detail-item">
              <mat-icon>storage</mat-icon>
              <span class="detail-label">Statut:</span>
              <span class="detail-value">ARCHIVÉE</span>
            </div>
            <div class="archived-actions">
              <p class="action-hint">📦 L'historique et les données associées sont conservés</p>
            </div>
          </div>

          <div *ngIf="data.action === 'DELETED'" class="deleted-details" [@slideInUp]>
            <div class="detail-header success">
              <mat-icon>delete_forever</mat-icon>
              <span>Suppression définitive</span>
            </div>
            <div class="detail-item">
              <mat-icon>check_circle</mat-icon>
              <span class="detail-label">Dépendances détectées:</span>
              <span class="detail-value success">Aucune</span>
            </div>
            <div class="deleted-actions">
              <p class="action-hint success">✅ La campagne a été complètement supprimée</p>
            </div>
          </div>

          <div *ngIf="data.action === 'CANCELLED'" class="archived-details" [@slideInUp]>
            <div class="detail-header">
              <mat-icon>cancel</mat-icon>
              <span>Campagne annulee</span>
            </div>
            <div class="detail-item">
              <mat-icon>flag</mat-icon>
              <span class="detail-label">Nouveau statut:</span>
              <span class="detail-value">CANCELLED</span>
            </div>
            <div class="detail-item">
              <mat-icon>mail</mat-icon>
              <span class="detail-label">Notification:</span>
              <span class="detail-value">Event Managers informes</span>
            </div>
            <div class="archived-actions">
              <p class="action-hint">La campagne reste conservee avec son historique, mais elle est annulee.</p>
            </div>
          </div>

          <div *ngIf="data.action === 'ERROR'" class="error-details" [@slideInUp]>
            <div class="detail-header error">
              <mat-icon>error_outline</mat-icon>
              <span>Erreur de traitement</span>
            </div>
            <div class="error-message">
              {{ data.message || 'Une erreur inconnue est survenue lors du traitement.' }}
            </div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="center">
        <button mat-raised-button color="primary" (click)="close()" class="action-button">
          <mat-icon>check_circle</mat-icon>
          <span>Compris</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  animations: [
    trigger('slideInUp', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)', 
          style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ]),
    trigger('scaleIn', [
      transition(':enter', [
        style({ transform: 'scale(0.5)', opacity: 0 }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)', 
          style({ transform: 'scale(1)', opacity: 1 }))
      ])
    ]),
    trigger('pulse', [
      transition('* => true', [
        animate('600ms ease-in-out', 
          style({ transform: 'scale(1.05)' })),
        animate('600ms ease-in-out', 
          style({ transform: 'scale(1)' }))
      ])
    ])
  ],
  styles: [`
    .delete-result-dialog {
      min-width: 360px;
    }

    .dialog-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      text-align: center;
    }

    .dialog-header.locked {
      background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%);
    }

    .dialog-header.archived {
      background: linear-gradient(135deg, #ECEFF1 0%, #CFD8DC 100%);
    }

    .dialog-header.deleted {
      background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%);
    }

    .dialog-header.error {
      background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%);
    }

    .result-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .locked .result-icon { color: #E65100; }
    .archived .result-icon { color: #546E7A; }
    .deleted .result-icon { color: #C62828; }
    .error .result-icon { color: #D32F2F; }

    h2 {
      margin: 0;
      font-size: 20px;
    }

    .locked h2 { color: #E65100; }
    .archived h2 { color: #546E7A; }
    .deleted h2 { color: #C62828; }
    .error h2 { color: #D32F2F; }

    .icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin-bottom: 12px;
    }

    .locked .icon-wrapper {
      background: rgba(230, 81, 0, 0.1);
    }

    .archived .icon-wrapper {
      background: rgba(84, 110, 122, 0.1);
    }

    .deleted .icon-wrapper {
      background: rgba(198, 40, 40, 0.1);
    }

    .error .icon-wrapper {
      background: rgba(211, 47, 47, 0.1);
    }

    .result-content {
      padding: 16px 0;
    }

    .result-message {
      font-size: 15px;
      color: #333;
      text-align: center;
      line-height: 1.5;
      margin: 0;
    }

    .locked-details, .archived-details, .deleted-details, .error-details {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
    }

    .locked-details {
      background: #FFF3E0;
      border-left: 4px solid #E65100;
    }

    .archived-details {
      background: #ECEFF1;
      border-left: 4px solid #546E7A;
    }

    .deleted-details {
      background: #E8F5E9;
      border-left: 4px solid #2E7D32;
    }

    .error-details {
      background: #FFEBEE;
      border-left: 4px solid #D32F2F;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
      color: #555;
    }

    .detail-header.success {
      color: #2E7D32;
    }

    .detail-header.error {
      color: #D32F2F;
    }

    .detail-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      font-size: 14px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .detail-item:last-of-type {
      border-bottom: none;
    }

    .detail-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
      flex-shrink: 0;
    }

    .detail-label {
      color: #666;
      font-weight: 500;
    }

    .detail-value {
      color: #333;
      font-weight: 600;
      margin-left: auto;
    }

    .detail-value.success {
      color: #2E7D32;
    }

    .locked-actions, .archived-actions, .deleted-actions {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .action-hint {
      font-size: 13px;
      margin: 0;
      padding: 8px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.05);
      color: #555;
    }

    .action-hint.success {
      background: rgba(46, 125, 50, 0.1);
      color: #2E7D32;
    }

    .error-message {
      font-size: 14px;
      color: #D32F2F;
      padding: 12px;
      background: rgba(211, 47, 47, 0.05);
      border-radius: 4px;
      line-height: 1.5;
    }

    mat-dialog-actions {
      padding: 20px;
      gap: 12px;
    }

    .action-button {
      min-width: 140px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-button mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `]
})
export class CampaignDeleteResultDialogComponent implements OnInit {
  animateIcon = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DeleteCampaignResult,
    private dialogRef: MatDialogRef<CampaignDeleteResultDialogComponent>
  ) {}

  ngOnInit(): void {
    // Trigger pulse animation when dialog opens
    setTimeout(() => this.animateIcon = true, 300);
  }

  getIcon(): string {
    switch (this.data.action) {
      case 'CANCELLED': return 'cancel';
      case 'LOCKED': return 'lock';
      case 'ARCHIVED': return 'archive';
      case 'DELETED': return 'delete_forever';
      case 'ERROR': return 'error';
      default: return 'info';
    }
  }

  getTitle(): string {
    switch (this.data.action) {
      case 'LOCKED': return 'Campagne verrouillée';
      case 'ARCHIVED': return 'Campagne archivée';
      case 'DELETED': return 'Campagne supprimée';
      case 'ERROR': return 'Erreur';
      default: return 'Résultat';
    }
  }

  getDefaultMessage(): string {
    switch (this.data.action) {
      case 'LOCKED':
        return 'La suppression intelligente a détecté des événements ou des participants actifs. La campagne a été verrouillée pour protéger les données.';
      case 'ARCHIVED':
        return 'La suppression intelligente a conservé la campagne en archive afin de préserver l’historique.';
      case 'DELETED':
        return 'La suppression intelligente n’a trouvé aucune dépendance. La campagne a été supprimée définitivement.';
      case 'ERROR':
        return 'Une erreur est survenue lors du traitement.';
      default:
        return '';
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
