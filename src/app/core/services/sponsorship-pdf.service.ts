import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

export interface SponsorshipProposalPdfInput {
  sponsorName: string;
  sponsorEmail?: string;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
  proposalSummary?: string;
  requestedAmount?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface SponsorshipHistoryPdfRow {
  eventName: string;
  statusLabel: string;
  runningLabel: string;
  createdAtLabel: string;
}

@Injectable({
  providedIn: 'root'
})
export class SponsorshipPdfService {
  private readonly clubLogoPath = '/assets/logos/Logo+Nom+Slogan.png';
  private readonly cluverseLogoPath = '/assets/logos/LogoSimple.png';

  async generateProposalPdf(input: SponsorshipProposalPdfInput): Promise<File> {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const [clubLogo, cluverseLogo] = await Promise.all([
      this.toDataUrl(this.clubLogoPath),
      this.toDataUrl(this.cluverseLogoPath)
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 46;

    doc.setFillColor(247, 249, 252);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin - 12, margin - 12, pageWidth - 2 * (margin - 12), pageHeight - 2 * (margin - 12), 12, 12, 'F');

    doc.addImage(clubLogo, 'PNG', margin, margin, 120, 36);
    doc.addImage(cluverseLogo, 'PNG', pageWidth - margin - 42, margin - 2, 42, 42);

    doc.setTextColor(28, 45, 64);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text('Sponsorship Partnership Proposal', margin, 122);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(74, 85, 104);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, 144);

    const eventName = input.eventName?.trim() || 'Upcoming Club Event';
    const eventDate = input.eventDate?.trim() || 'To be confirmed';
    const eventLocation = input.eventLocation?.trim() || 'To be confirmed';

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('To', margin, 180);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const sponsorLine = `${input.sponsorName}${input.sponsorEmail ? ` (${input.sponsorEmail})` : ''}`;
    doc.text(sponsorLine, margin, 198);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Event Overview', margin, 236);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const overviewLines = [
      `Event: ${eventName}`,
      `Date: ${eventDate}`,
      `Location: ${eventLocation}`,
      `Requested Sponsorship: ${input.requestedAmount?.trim() || 'To be discussed'}`
    ];
    let y = 255;
    for (const line of overviewLines) {
      doc.text(line, margin, y);
      y += 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Partnership Pitch', margin, 336);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);

    const summary = input.proposalSummary?.trim() ||
      'We believe this event offers a strong visibility opportunity through direct student engagement, high-value digital reach, and on-site brand activation. We would be honored to collaborate with your organization as a strategic sponsor and deliver measurable exposure before, during, and after the event.';

    const wrappedSummary = doc.splitTextToSize(summary, pageWidth - margin * 2);
    doc.text(wrappedSummary, margin, 356);

    const signOffY = 510;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Proposed Next Step', margin, signOffY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const nextStepText = 'If this opportunity aligns with your goals, we would be glad to schedule a short call and finalize the sponsorship package and deliverables.';
    doc.text(doc.splitTextToSize(nextStepText, pageWidth - margin * 2), margin, signOffY + 20);

    const contactName = input.contactName?.trim() || 'Sponsorship Team';
    const contactRole = input.contactRole?.trim() || 'Cluverse Sponsorship Department';
    const contactEmail = input.contactEmail?.trim() || 'contact@cluverse.tn';
    const contactPhone = input.contactPhone?.trim() || '+216 XX XXX XXX';

    doc.setFont('helvetica', 'bold');
    doc.text('Contact', margin, 620);
    doc.setFont('helvetica', 'normal');
    doc.text(`${contactName} - ${contactRole}`, margin, 638);
    doc.text(`Email: ${contactEmail}`, margin, 656);
    doc.text(`Phone: ${contactPhone}`, margin, 674);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 58, pageWidth - margin, pageHeight - 58);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9.5);
    doc.text('Prepared by Cluverse in partnership with the club organization team.', margin, pageHeight - 38);

    const pdfBlob = doc.output('blob');
    const normalizedEvent = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'event';
    const normalizedSponsor = input.sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sponsor';
    const fileName = `proposal-${normalizedEvent}-${normalizedSponsor}.pdf`;

    return new File([pdfBlob], fileName, { type: 'application/pdf' });
  }

  generateSponsorshipHistoryPdf(sponsorName: string, rows: SponsorshipHistoryPdfRow[]): void {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 46;

    const drawHeader = (pageNumber: number): number => {
      doc.setFillColor(247, 249, 252);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin - 12, margin - 12, pageWidth - 2 * (margin - 12), pageHeight - 2 * (margin - 12), 10, 10, 'F');

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Sponsorship History Report', margin, 74);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`Sponsor: ${sponsorName}`, margin, 96);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 113);

      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 44, pageHeight - 30);

      let y = 146;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.8);
      doc.line(margin, y, pageWidth - margin, y);

      y += 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text('Event', margin, y);
      doc.text('Column', margin + 210, y);
      doc.text('Running', margin + 340, y);
      doc.text('Created', margin + 430, y);
      return y + 12;
    };

    if (!rows.length) {
      const y = drawHeader(1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text('No sponsorship history found for this sponsor.', margin, y + 24);
      doc.save(`sponsorship-history-${this.slugify(sponsorName)}.pdf`);
      return;
    }

    let page = 1;
    let y = drawHeader(page);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const row of rows) {
      if (y > pageHeight - 74) {
        doc.addPage();
        page += 1;
        y = drawHeader(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      const eventLines = doc.splitTextToSize(row.eventName || '--', 190);
      const statusLines = doc.splitTextToSize(row.statusLabel || '--', 120);
      const runningLines = doc.splitTextToSize(row.runningLabel || '--', 72);
      const createdLines = doc.splitTextToSize(row.createdAtLabel || '--', 120);
      const lineCount = Math.max(eventLines.length, statusLines.length, runningLines.length, createdLines.length);
      const rowHeight = Math.max(18, lineCount * 12 + 6);

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

      doc.setTextColor(15, 23, 42);
      doc.text(eventLines, margin, y + 12);
      doc.text(statusLines, margin + 210, y + 12);
      doc.text(runningLines, margin + 340, y + 12);
      doc.text(createdLines, margin + 430, y + 12);

      y += rowHeight;
    }

    doc.save(`sponsorship-history-${this.slugify(sponsorName)}.pdf`);
  }

  private slugify(value: string): string {
    const normalized = (value || 'sponsor').toLowerCase().trim();
    const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return slug || 'sponsor';
  }

  private async toDataUrl(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load logo: ${path}`);
    }

    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Failed to read logo: ${path}`));
      reader.readAsDataURL(blob);
    });
  }
}
