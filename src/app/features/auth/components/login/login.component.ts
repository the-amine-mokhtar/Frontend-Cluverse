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

  constructor() { }

  ngOnInit(): void {
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
