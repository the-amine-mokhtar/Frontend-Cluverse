import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RecruitmentHomeComponent } from './components/recruitment-home/recruitment-home.component';

const routes: Routes = [
  {
    path: '',
    component: RecruitmentHomeComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RecruitmentRoutingModule { }
