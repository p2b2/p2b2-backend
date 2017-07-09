import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import 'hammerjs';
import {AppComponent} from './app.component';
import {AccountInfoComponent} from './account-info/account-info.component';
import {ChartsComponent} from './charts/charts.component';
import {GraphComponent} from './graph/graph.component';
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {
  MD_PLACEHOLDER_GLOBAL_OPTIONS, MdAutocompleteModule, MdButtonModule, MdButtonToggleModule, MdCardModule,
  MdCheckboxModule, MdChipsModule,
  MdCoreModule,
  MdDatepickerModule,
  MdDialogModule,
  MdExpansionModule, MdGridListModule,
  MdIconModule,
  MdInputModule,
  MdListModule,
  MdMenuModule,
  MdNativeDateModule, MdPaginatorModule,
  MdProgressBarModule,
  MdProgressSpinnerModule,
  MdRadioModule,
  MdRippleModule,
  MdSelectModule,
  MdSidenavModule,
  MdSliderModule,
  MdSlideToggleModule,
  MdSnackBarModule, MdSortModule, MdTableModule,
  MdTabsModule,
  MdToolbarModule,
  MdTooltipModule
} from "@angular/material";
import {RouterModule, Routes} from "@angular/router";
import {HttpModule} from "@angular/http";
import {FormsModule} from "@angular/forms";
import {EthereumAnalysisService} from "../services/ethereum-analysis.service";
import {CdkTableModule} from '@angular/cdk';

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
    FormsModule,
    HttpModule,
    RouterModule.forRoot(appRoutes),
    CdkTableModule,
    MdButtonModule,
    MdCheckboxModule,
    MdMenuModule,
    MdIconModule,
    MdToolbarModule,
    MdAutocompleteModule,
    MdButtonToggleModule,
    MdCardModule,
    MdChipsModule,
    MdCoreModule,
    MdDatepickerModule,
    MdDialogModule,
    MdExpansionModule,
    MdGridListModule,
    MdInputModule,
    MdListModule,
    MdNativeDateModule,
    MdPaginatorModule,
    MdProgressBarModule,
    MdProgressSpinnerModule,
    MdRadioModule,
    MdRippleModule,
    MdSelectModule,
    MdSidenavModule,
    MdSliderModule,
    MdSlideToggleModule,
    MdSnackBarModule,
    MdSortModule,
    MdTableModule,
    MdTabsModule,
    MdTooltipModule
  ],
  providers: [EthereumAnalysisService,
    {provide: MD_PLACEHOLDER_GLOBAL_OPTIONS, useValue: {float: 'auto'}}
  ],
  bootstrap: [AppComponent]
})

export class AppModule {
}
