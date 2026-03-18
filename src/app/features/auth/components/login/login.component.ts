import { Component, OnInit } from '@angular/core';
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
  }

  // Image Cropper Methods
  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
    this.showCropper = true;
    this.croppedImage = ''; // reset previous crop
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
    
    // Update logo in form just in case
    this.clubForm.logo = this.croppedImage;

    console.log('Submitting club application:', this.clubForm);
    this.apiService.applyForClubCreation(this.clubForm).subscribe({
      next: (response) => {
        console.log('Application submitted successfully:', response);
        this.router.navigate(['/auth/thank-you']);
      },
      error: (error) => {
        console.error('Error submitting application:', error);
      }
    });
  }
      
}
