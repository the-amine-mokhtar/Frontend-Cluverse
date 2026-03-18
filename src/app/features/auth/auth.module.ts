import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
import { ImageCropperComponent } from 'ngx-image-cropper';

@NgModule({
  declarations: [
    LoginComponent
  ],
  imports: [
    SharedModule,
    ImageCropperComponent,
    AuthRoutingModule
  ]
})
export class AuthModule { }
