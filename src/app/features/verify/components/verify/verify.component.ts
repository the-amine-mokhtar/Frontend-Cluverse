import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.scss'
})
export class VerifyComponent implements OnInit {

  message = '';
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.message = 'Code invalide';
      this.loading = false;
      return;
    }

    this.http.get<any>(`http://localhost:8081/api/clubs/verify?code=${code}`)
      .subscribe({
        next: (res) => {
          this.message = res.message;
          this.loading = false;
        },
        error: (err) => {
          this.message = err.error.message || 'Erreur de vérification';
          this.loading = false;
        }
      });
  }

  goToLogin() {
  this.router.navigate(['/auth']);
}
}