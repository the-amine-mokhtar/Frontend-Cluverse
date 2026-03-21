import { Component, OnInit, OnChanges, SimpleChanges, ViewChild, Output, EventEmitter, Input} from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-club-application',
  templateUrl: './club-application.component.html',
  styleUrl: './club-application.component.scss'
})
export class ClubApplicationComponent implements OnInit, OnChanges {

  // Outputs: notify parent to show/hide cropper
  @Output() showCropperModal = new EventEmitter<any>(); // emits the file event
  @Output() cancelCrop = new EventEmitter<void>();       // emits when user removes the image

  // Input: cropped image URL coming back from parent
  @Input() croppedImageFromParent: any = '';
  // Input: parent signals that crop was accepted (clears the pending file event)
  @Input() cropAccepted: boolean = false;

    // Image Cropper State (kept for file-upload UI toggle)
    imageChangedEvent: any = '';
  
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
      
    }

    ngOnChanges(changes: SimpleChanges): void {
      // When the parent accepts the crop, clear imageChangedEvent so the preview becomes visible
      if (changes['cropAccepted'] && this.cropAccepted) {
        this.imageChangedEvent = '';
      }
    }
  

  
    // Image Cropper Methods
    fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;  // kept so the upload button hides
    this.signupErrors.logo = '';
    this.showCropperModal.emit(event); // pass the real event to the parent
}
  
    // Called by parent when the crop is accepted — nothing to do in the child,
    // the result comes back via croppedImageFromParent @Input.

    removeImage(event: Event) {
      event.preventDefault(); // Prevent form submit
      this.imageChangedEvent = '';      // show the upload button again
      this.signupErrors.logo = '';
      this.clubForm.logo = '';
      this.cancelCrop.emit();           // tell parent to reset its croppedImage
    }
  
    
  
    imageLoaded() { }
    cropperReady() { }
    loadImageFailed() {
      console.error('Image load failed');
    }
  
    // Translates the vanilla JS changeForm logic into Angular state
    
  
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
            if (this.croppedImageFromParent && clubId) {
              fetch(this.croppedImageFromParent)
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
  
    if (!this.croppedImageFromParent) {
      this.signupErrors.logo = 'Please upload a club logo.';
      return false;
    }
  
    if (this.aForm.invalid) {
      return false;
    }
  
    return true;
  }
        
  }
