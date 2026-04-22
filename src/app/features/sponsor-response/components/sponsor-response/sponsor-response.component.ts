import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-sponsor-response',
  templateUrl: './sponsor-response.component.html',
  styleUrls: ['./sponsor-response.component.scss']
})
export class SponsorResponseComponent implements OnInit {
  result = '';
  title = 'Thank You';
  message = 'Your answer has been received successfully.';
  badge = 'Processed';

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.result = (params.get('result') || '').toLowerCase();
      this.applyContent();
    });
  }

  constructor(private route: ActivatedRoute) {}

  private applyContent(): void {
    switch (this.result) {
      case 'confirmed':
        this.title = 'Thank You for Confirming';
        this.message = 'Your sponsorship confirmation has been received. We appreciate your support.';
        this.badge = 'Confirmed';
        break;
      case 'sponsorship-accepted':
        this.title = 'Sponsorship Accepted';
        this.message = 'Thank you for accepting. We have sent your contract by email.';
        this.badge = 'Accepted';
        break;
      case 'sponsorship-declined':
        this.title = 'Response Received';
        this.message = 'Your decline has been recorded. Thank you for your quick response.';
        this.badge = 'Declined';
        break;
      case 'signed-uploaded':
        this.title = 'Signed Contract Received';
        this.message = 'Thank you. Your signed contract has been uploaded successfully.';
        this.badge = 'Signed';
        break;
      case 'signed-upload-failed':
        this.title = 'Upload Failed';
        this.message = 'We could not process your signed contract upload. Please retry using the same email link.';
        this.badge = 'Failed';
        break;
      case 'denied':
        this.title = 'Response Received';
        this.message = 'Your answer has been received. Thank you for taking the time to respond.';
        this.badge = 'Denied';
        break;
      default:
        this.title = 'Invitation Not Available';
        this.message = 'This invitation is invalid or has expired.';
        this.badge = 'Invalid';
        break;
    }
  }
}
