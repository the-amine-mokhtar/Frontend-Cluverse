import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
import { Login2Component } from './components/login2/login2.component';
import { ImageCropperComponent } from 'ngx-image-cropper';
import { AuthContainerComponent } from './components/auth-container/auth-container.component';
import { ClubApplicationComponent } from './components/club-application/club-application.component';
import { MemberLoginComponent } from './components/member-login/member-login.component';

@NgModule({
  declarations: [
    LoginComponent,
    Login2Component,
    AuthContainerComponent,
    ClubApplicationComponent,
    MemberLoginComponent
  ],
  imports: [
    SharedModule,
    ImageCropperComponent,
    AuthRoutingModule
  ]
})
export class AuthModule { }