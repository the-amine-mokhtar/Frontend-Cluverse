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
