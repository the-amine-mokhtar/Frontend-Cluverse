import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { Login2Component } from './components/login2/login2.component';
import { ThankYouComponent } from './components/thank-you/thank-you.component';
import { AuthContainerComponent } from './components/auth-container/auth-container.component';
import { OAuth2CallbackComponent } from './components/oauth2-callback/oauth2-callback.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';


const routes: Routes = [
  { path: 'login', component: AuthContainerComponent },
  { path: 'login2', component: Login2Component },
  { path: 'thank-you', component: ThankYouComponent },
  { path: 'oauth2-callback', component: OAuth2CallbackComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
