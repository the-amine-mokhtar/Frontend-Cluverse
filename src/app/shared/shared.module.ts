import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { FinancialAgentWidgetComponent } from './components/financial-agent-widget/financial-agent-widget.component';

@NgModule({
  declarations: [
    NotFoundComponent,
    FinancialAgentWidgetComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NotFoundComponent,
    FinancialAgentWidgetComponent
  ]
})
export class SharedModule { }
