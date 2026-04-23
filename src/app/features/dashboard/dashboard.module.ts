import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { ImageCropperComponent } from 'ngx-image-cropper';

import { DashboardLayoutComponent } from './components/layout/dashboard-layout/dashboard-layout.component';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { HeaderComponent } from './components/layout/header/header.component';
import { HomeComponent } from './components/home/home.component';
import { ThemeToggleComponent } from './components/layout/header/theme-toggle/theme-toggle.component';
import { ProfileComponent } from './components/profile/profile.component';
import { MembersComponent } from './components/members/members.component';

@NgModule({
  declarations: [
    DashboardLayoutComponent,
    SidebarComponent,
    HeaderComponent,
    HomeComponent,
    ThemeToggleComponent,
    ProfileComponent,
    MembersComponent
  ],
  imports: [
    SharedModule,
    RouterModule,
    DashboardRoutingModule,
    ImageCropperComponent
  ]
})
export class DashboardModule { }
