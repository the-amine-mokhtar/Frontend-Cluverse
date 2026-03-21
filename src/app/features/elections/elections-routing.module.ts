import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ElectionsHomeComponent } from './components/elections-home/elections-home.component';

const routes: Routes = [
  {
    path: '',
    component: ElectionsHomeComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ElectionsRoutingModule { }
