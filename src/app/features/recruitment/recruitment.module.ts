import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { RecruitmentRoutingModule } from './recruitment-routing.module';
import { RecruitmentHomeComponent } from './components/recruitment-home/recruitment-home.component';

@NgModule({
  declarations: [
    RecruitmentHomeComponent
  ],
  imports: [
    SharedModule,
    RecruitmentRoutingModule
  ]
})
export class RecruitmentModule { }
