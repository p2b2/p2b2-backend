import { Component, OnInit } from '@angular/core';
import {EthereumAnalysisService} from "../../services/ethereum-analysis.service";

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.css']
})
export class RankingComponent implements OnInit {

   private topRevenueSent = [];
   private topRevenueReceived = [];
   private topGasRevenue = [];

  constructor(private eas: EthereumAnalysisService) { }

  ngOnInit() {
      this.getTopRevenue();
  }

  private getTopRevenue(){
      this.eas.getTopRevenueSent(3).subscribe((result) => {
          let topAccounts = result.json();
          for (var i = 0; i < topAccounts.length; ++i) {
            topAccounts[i].rank = i+1
          }
          this.topRevenueSent = topAccounts
      })
      this.eas.getTopRevenueReceived(3).subscribe((result) => {
          let topAccounts = result.json();
          for (var i = 0; i < topAccounts.length; ++i) {
            topAccounts[i].rank = i+1
          }
          this.topRevenueReceived = topAccounts
      })
      this.eas.getTopGasRevenue(3).subscribe((result) => {
          let topAccounts = result.json();
          for (var i = 0; i < topAccounts.length; ++i) {
            topAccounts[i].rank = i+1
          }
          this.topGasRevenue = topAccounts
      })
  }

}
