import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
import { Login2Component } from './components/login2/login2.component';
import { ImageCropperComponent } from 'ngx-image-cropper';
import { AuthContainerComponent } from './components/auth-container/auth-container.component';
import { ClubApplicationComponent } from './components/club-application/club-application.component';
import { MemberLoginComponent } from './components/member-login/member-login.component';
import { OAuth2ButtonsComponent } from './components/oauth2-buttons/oauth2-buttons.component';
import { OAuth2CallbackComponent } from './components/oauth2-callback/oauth2-callback.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { RecaptchaModule, RecaptchaFormsModule } from 'ng-recaptcha';

@NgModule({
  declarations: [
    LoginComponent,
    Login2Component,
    AuthContainerComponent,
    ClubApplicationComponent,
    MemberLoginComponent,
    OAuth2ButtonsComponent,
    OAuth2CallbackComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent
  ],
  imports: [
    SharedModule,
    ImageCropperComponent,
    AuthRoutingModule,
    RecaptchaModule,
    RecaptchaFormsModule
  ]
})
export class AuthModule { }