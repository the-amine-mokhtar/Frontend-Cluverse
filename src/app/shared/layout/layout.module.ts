import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../shared.module';

import { HeaderComponent } from '../../features/dashboard/components/layout/header/header.component';
import { SidebarComponent } from '../../features/dashboard/components/layout/sidebar/sidebar.component';
import { ThemeToggleComponent } from '../../features/dashboard/components/layout/header/theme-toggle/theme-toggle.component';

@NgModule({
  declarations: [HeaderComponent, SidebarComponent, ThemeToggleComponent],
  imports: [SharedModule, RouterModule],
  exports: [HeaderComponent, SidebarComponent, ThemeToggleComponent]
})
export class LayoutModule {}
