import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  // State controls for the neumorphic slider
  isSignUpActive = false;
  isAnimating = false;

  // Club selection state
  clubs: string[] = [];
  selectedClub: string = '';

  // Login form data
  loginForm: any = {
  connectionIdentifier: '',
  password: '',
  clubName: ''
};

  // Image Cropper State
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper: boolean = false;

  // Club application form data
  clubForm: any = {
    name: '',
    description: '',
    activitySector: '',
    creationDate: '',
    email: '',
    status: '',
    logo: '',
    isClubVerified: false,
    
  };

  @ViewChild('aForm') aForm: any;


  constructor(private apiService: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.apiService.getClubsNames().subscribe({
      next: (response) => {
        this.clubs = response;
      },
      error: (error) => {
        console.error('Error fetching clubs:', error);
      }
    });
  }

  onClubSelect(event: any): void {
  this.selectedClub = event.target.value;
  this.loginForm.clubName = event.target.value;
}

  // Image Cropper Methods
  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
    this.showCropper = true;
    this.croppedImage = ''; // reset previous crop
    this.signupErrors.logo = '';
  }

  imageCropped(event: any) {
    // ngx-image-cropper returns base64 or objectUrl
    this.croppedImage = event.objectUrl || event.base64;
  }

  acceptCrop(event: Event) {
    event.preventDefault(); // Prevent form submit
    this.showCropper = false;
    this.clubForm.logo = this.croppedImage;
  }

  removeImage(event: Event) {
    event.preventDefault(); // Prevent form submit
    this.imageChangedEvent = '';
    this.croppedImage = '';
    this.showCropper = false;
    this.clubForm.logo = '';
  }

  

  imageLoaded() { }
  cropperReady() { }
  loadImageFailed() {
    console.error('Image load failed');
  }

  // Translates the vanilla JS changeForm logic into Angular state
  toggleForm(event: Event): void {
    event.preventDefault();
    
    // Equivalent to switchCtn.classList.add("is-gx") and setTimeout removing it
    this.isAnimating = true;
    setTimeout(() => {
      this.isAnimating = false;
    }, 1500);

    // Equivalent to toggle("is-txr") and toggle("is-txl")
    this.isSignUpActive = !this.isSignUpActive;
  }

  submitApplication(event: Event): void {
  if (event) event.preventDefault();

  if (!this.validateSignupForm()) return;

  this.apiService.checkEmailExists(this.clubForm.email).subscribe({
    next: (exists) => {
      if (exists) {
        this.signupErrors.email = 'This email is already used by another club.';
        return;
      }

      this.apiService.applyForClubCreation(this.clubForm).subscribe({
        next: (response) => {
          const clubId = response.id;
          if (this.croppedImage && clubId) {
            fetch(this.croppedImage)
              .then(r => r.blob())
              .then(blob => {
                const formData = new FormData();
                formData.append('file', blob, 'logo.png');
                return this.apiService.uploadClubLogo(clubId, formData).toPromise();
              })
              .then(() => this.router.navigate(['/auth/thank-you']))
              .catch(() => this.router.navigate(['/auth/thank-you']));
          } else {
            this.router.navigate(['/auth/thank-you']);
          }
        },
        error: (error) => {
          console.error('Error submitting application:', error);
        }
      });
    },
    error: (error) => {
      console.error('Error checking email:', error);
    }
  });
}

  goToForgotPassword(): void {
  this.router.navigate(['/auth/forgot-password']);
}

submitLogin(event: Event): void {
  event.preventDefault();
  console.log('loginForm:', this.loginForm);
  this.apiService.login(
    this.loginForm.connectionIdentifier,
    this.loginForm.password,
    this.loginForm.clubName
  ).subscribe({
    next: (response) => {
      localStorage.setItem('token', response.token);
      this.router.navigate(['/dashboard']);
    },
    error: (error) => {
      console.error('Login failed:', error);
    }
  });
}

signupErrors: any = {
  name: '',
  description: '',
  activitySector: '',
  creationDate: '',
  email: '',
  status: '',
  logo: ''
};

validateSignupForm(): boolean {
  Object.values(this.aForm.controls).forEach((control: any) => {
    control.markAsTouched();
  });

  if (!this.croppedImage) {
    this.signupErrors.logo = 'Please upload a club logo.';
    return false;
  }

  if (this.aForm.invalid) {
    return false;
  }

  return true;
}
      
}
