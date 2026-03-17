import { Component } from '@angular/core';

export interface TrustedLogo {
  name: string;
  image: string;
}

@Component({
  selector: 'app-trusted-by',
  templateUrl: './trusted-by.component.html',
  styleUrls: ['./trusted-by.component.scss']
})
export class TrustedByComponent {

  // We duplicate the logo multiple times here so the slider has enough items to loop seamlessly.
  // In a real scenario with more partners, you would replace these with different logos.
  logos: TrustedLogo[] = [
    { name: 'Esprit', image: 'assets/TrustedBy/logo_esprit.png' },
    { name: 'Google', image: 'assets/TrustedBy/logo_google.png' },
    { name: 'Esprit', image: 'assets/TrustedBy/logo_esprit.png' },
    { name: 'Esprit', image: 'assets/TrustedBy/logo_esprit.png' },
    { name: 'Esprit', image: 'assets/TrustedBy/logo_esprit.png' },
    { name: 'Esprit', image: 'assets/TrustedBy/logo_esprit.png' },
    { name: 'Esprit', image: 'assets/TrustedBy/logo_esprit.png' }
  ];
}
