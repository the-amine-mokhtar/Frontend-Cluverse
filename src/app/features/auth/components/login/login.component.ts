import { Component, OnInit } from '@angular/core';

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
  clubs: string[] = [
    'Esprit Robotics',
    'Google Developer Student Club',
    'Microsoft Learn Student Ambassador',
    'Enactus',
    'IEEE'
  ];
  selectedClub: string = '';

  // Image Cropper State
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper: boolean = false;

  constructor() { }

  ngOnInit(): void {
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
  }

  removeImage(event: Event) {
    event.preventDefault(); // Prevent form submit
    this.imageChangedEvent = '';
    this.croppedImage = '';
    this.showCropper = false;
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
}
