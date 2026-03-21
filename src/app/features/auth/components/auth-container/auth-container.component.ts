import { Component } from '@angular/core';

@Component({
  selector: 'app-auth-container',
  templateUrl: './auth-container.component.html',
  styleUrl: './auth-container.component.scss'
})
export class AuthContainerComponent {

  isSignUpActive = false;
  isAnimating = false;

  showCropper = false;
  imageChangedEvent: any = '';
  croppedImage: any = '';
  cropAccepted = false;

  toggleForm(event: Event): void {
    event.preventDefault();
    this.isAnimating = true;
    setTimeout(() => { this.isAnimating = false; }, 1500);
    this.isSignUpActive = !this.isSignUpActive;
  }

  onShowCropper(imageEvent: any): void {
    this.imageChangedEvent = imageEvent;
    this.showCropper = true;
  }

  imageCropped(event: any): void {
    this.croppedImage = event.objectUrl || event.base64;
  }

  onAcceptCrop(): void {
    this.showCropper = false;
    this.cropAccepted = true; // signal the child to clear its imageChangedEvent
  }

  onCancelCrop(): void {
    this.imageChangedEvent = '';
    this.croppedImage = '';
    this.showCropper = false;
    this.cropAccepted = false;
  }

  imageLoaded() {}
  cropperReady() {}
  loadImageFailed() {}
}