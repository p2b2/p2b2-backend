import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import 'hammerjs';
import { AppComponent } from './app.component';
import { AccountInfoComponent } from './account-info/account-info.component';
import { ChartsComponent } from './charts/charts.component';
import { GraphComponent } from './graph/graph.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {MdButtonModule, MdCheckboxModule, MdIconModule, MdMenuModule, MdToolbarModule} from "@angular/material";
import {RouterModule, Routes} from "@angular/router";

const appRoutes: Routes = [
  {path: 'charts', component: ChartsComponent},
  {path: 'graph', component: GraphComponent},
  {path: 'account', component: AccountInfoComponent},
  {path: '', redirectTo: '/account', pathMatch: 'full'}
];

@NgModule({
  declarations: [
    AppComponent,
    AccountInfoComponent,
    ChartsComponent,
    GraphComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MdButtonModule,
    MdCheckboxModule,
    MdMenuModule,
    MdIconModule,
    MdToolbarModule,
    RouterModule.forRoot(appRoutes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})

export class AppModule { }
