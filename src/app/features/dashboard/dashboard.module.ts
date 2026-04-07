import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LayoutModule } from '../../shared/layout/layout.module';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { ImageCropperComponent } from 'ngx-image-cropper';

import { DashboardLayoutComponent } from './components/layout/dashboard-layout/dashboard-layout.component';
import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';
import { MembersComponent } from './components/members/members.component';

@NgModule({
  declarations: [
    DashboardLayoutComponent,
    HomeComponent,
    ProfileComponent,
    MembersComponent
  ],
  imports: [
    SharedModule,
    LayoutModule,
    RouterModule,
    DashboardRoutingModule,
    ImageCropperComponent
  ]
})
export class DashboardModule { }
