import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
import { Login2Component } from './components/login2/login2.component';
import { ImageCropperComponent } from 'ngx-image-cropper';

@NgModule({
  declarations: [
    LoginComponent,
    Login2Component
  ],
  imports: [
    SharedModule,
    ImageCropperComponent,
    AuthRoutingModule
  ]
})
export class AuthModule { }
