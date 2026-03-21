import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LogisticsHomeComponent } from './components/logistics-home/logistics-home.component';

const routes: Routes = [{ path: '', component: LogisticsHomeComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LogisticsRoutingModule { }
