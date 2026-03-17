import {
  Component,
  HostListener,
  OnInit
} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  isAffix = false;
  isMenuOpen = false;

  navLinks = [
    { label: 'Home', target: 'top' },
    { label: 'Pricing', target: 'pricing' },
    { label: 'Services', target: 'services-section' },
    { label: 'FAQ', target: 'faq' },
    { label: 'Team', target: 'team' },
    { label: 'About Us', target: 'footer' }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.checkScroll();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.checkScroll();
  }

  private checkScroll(): void {
    this.isAffix = window.scrollY > 50;
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  scrollTo(target: string): void {
    this.isMenuOpen = false;
    
    // Check if we are already on the home page (ignoring fragments)
    const isHome = this.router.url === '/' || this.router.url.startsWith('/#');

    if (isHome) {
      // Simply scroll without changing the URL
      if (target === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const el = document.getElementById(target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else {
      // Navigate to the home page with a fragment
      if (target === 'top') {
        this.router.navigate(['/']);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
      } else {
        this.router.navigate(['/'], { fragment: target });
      }
    }
  }
}
