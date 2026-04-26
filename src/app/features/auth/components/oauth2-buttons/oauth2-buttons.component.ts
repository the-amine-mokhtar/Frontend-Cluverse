import { Component, Input } from '@angular/core';
import { environment } from '../../../../../environments/environment.development';

/**
 * Reusable component for OAuth2 login buttons (Google & GitHub)
 * Can be used on any auth page
 */
@Component({
  selector: 'app-oauth2-buttons',
  templateUrl: './oauth2-buttons.component.html',
  styleUrls: ['./oauth2-buttons.component.scss']
})
export class OAuth2ButtonsComponent {
  @Input() title = 'Se connecter avec';
  @Input() showDivider = true;

  googleAuthUrl = `${environment.apiUrl}/oauth2/authorization/google`;
  githubAuthUrl = `${environment.apiUrl}/oauth2/authorization/github`;

  loginWithGoogle(): void {
    window.location.href = this.googleAuthUrl;
  }

  loginWithGitHub(): void {
    window.location.href = this.githubAuthUrl;
  }
}
