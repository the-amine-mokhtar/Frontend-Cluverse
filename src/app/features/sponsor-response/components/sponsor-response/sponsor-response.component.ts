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
    // no-op
  }

  constructor(private route: ActivatedRoute) {}

  ngAfterContentInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.result = (params.get('result') || '').toLowerCase();
      this.applyContent();
    });
  }

  private applyContent(): void {
    switch (this.result) {
      case 'confirmed':
        this.title = 'Thank You for Confirming';
        this.message = 'Your sponsorship confirmation has been received. We appreciate your support.';
        this.badge = 'Confirmed';
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
