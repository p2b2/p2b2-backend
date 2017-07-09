import {Injectable} from '@angular/core';
import {RequestOptions, Headers, Http} from "@angular/http";
import {Observable} from "rxjs/Observable";
import 'rxjs/Rx';

@Injectable()
export class EthereumAnalysisService {

  constructor(private http: Http) {
  }

  public getAccountDetails(): Observable<any> {
    // TODO Implement this. The code is just an example for arbitrary REST calls so far
    return this.http.get("http://localhost:3000")
      .map(res => {
        return res;
      })
      .catch(this.handleError);
  }

  public getAccountGraph(accountAddress: string): Observable<any> {
    return this.http.get("http://localhost:3000/graph/" + accountAddress)
      .map(res => {
        return res;
      })
      .catch(this.handleError);
  }

  public getDegreeCentrality(context: string): Observable<any> {
    return this.http.get("http://localhost:3000/graph/degreecentrality/" + context)
      .map(res => {
        let records = res.json().records;
        let result = [];
        records.forEach((account, index) => {
          result.push({place: index + 1, address: account._fields[0], degreeScore: account._fields[1].low});
        });
        return result;
      })
      .catch(this.handleError);
  }

  public getGraphForAccounts(accounts): Observable<any> {
    return this.http.get("http://localhost:3000/analytics/graph/accounts?addresses=" + JSON.stringify(accounts)).map(res => {
      return res.json();
    })
      .catch(this.handleError);
  }

  private handleError(error: Response | any) {
    // In a real world app, you might use a remote logging infrastructure
    let errMsg: string;
    if (error instanceof Response) {
      const body = error.json() || '';
      const err = (<any> body).error || JSON.stringify(body);
      errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
    } else {
      errMsg = error.message ? error.message : error.toString();
    }
    console.error(errMsg);
    return Observable.throw(errMsg);
  }

}
