import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { SkillsRoutingModule } from './skills-routing.module';
import { SkillsHomeComponent } from './components/skills-home/skills-home.component';

@NgModule({
  declarations: [SkillsHomeComponent],
  imports: [SharedModule, SkillsRoutingModule]
})
export class SkillsModule { }
