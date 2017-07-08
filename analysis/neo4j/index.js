'use strict';

const Promise = require("es6-promise").Promise;
const winston = require('winston');
const neo4j = require('neo4j-driver').v1;

// At RisingStack, we usually set the configuration from an environment variable called LOG_LEVEL
// winston.level = process.env.LOG_LEVEL
winston.level = 'info';

const username = "neo4j";
const password = "p2b2";
const uri = "bolt://localhost:7687";
var session = null;
var driver = null;

var Neo4jAnalyzer = function () {
};

Neo4jAnalyzer.prototype.connect = () => {
    return new Promise((resolve, reject) => {
        var newDriver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        let newSession = newDriver.session();

        if (newSession._open != true) {
            winston.log('error', 'Neo4jConnector - Driver instantiation failed');
            reject('Driver instantiation failed');
        } else {
            winston.log('info', 'Neo4jConnector - Driver instantiation succeeded');
            driver = newDriver;
            session = newSession;
            resolve(true);
        }

        // TODO: The approach below would be better, but for some reason it does not call the callbacks
        // Register a callback to know if driver creation was successful:
        /*newDriver.onCompleted = () => {
         driver = newDriver;
         session = newSession;
         resolve(newSession);
         };*/
        // Register a callback to know if driver creation failed.
        // This could happen due to wrong credentials or database unavailability:
        /*newDriver.onError = (error) => {
         reject(error);
         };*/
    })
};

Neo4jAnalyzer.prototype.disconnect = () => {
    session.close();
    driver.close();
};

Neo4jAnalyzer.prototype.getGraphForAccount = (accountAddress) => {
    return new Promise((resolve, reject) => {
        const resultPromise = session.run(
            'MATCH (accountOne:Account) WHERE accountOne.address=$address ' +
            'MATCH (neighbors:Account) ' +
            'WHERE (accountOne)-[]-(neighbors)' +
            'RETURN accountOne, neighbors',
            // The query below would return nodes and edges in one, but is not performing enough
            /*  'MATCH (accountOne:Account) WHERE accountOne.address=$address ' +
            'MATCH (neighbors:Account) ' +
            'WHERE (accountOne)-[]-(neighbors) ' +
            'MATCH (:Account {address: $address})-[r]-() ' +
            'RETURN accountOne, neighbors, r ' +
            'LIMIT 500',*/
            {address: accountAddress.toLowerCase()}
        );

        resultPromise.then(result => {
            let graphData = convertGraph(result);
            resolve(graphData);
        }).catch(error => reject(error));
    })
};

let convertGraph = function (neo4jNodeResponse, neo4jLinkResponse) {
    return {
        "nodes": convertGraphNodes(neo4jNodeResponse),
        "links": convertGraphLinks(neo4jLinkResponse)
    };
};

let convertGraphLinks = function (neo4jLinkResponse) {
    let addedLinks = [];
    let convertedLinks = [];
    // TODO
    return convertedLinks;
};

let convertGraphNodes = function (neo4jNodeResponse) {
  let addedAccounts = [];
  let convertedNodes = [];

  for (let i=0; i < neo4jNodeResponse.records.length; i++) {
      let singleRecord = neo4jNodeResponse.records[i];

      for (let j = 0; j < singleRecord.length; j++) {
          let node =  singleRecord.get(j);
          if (addedAccounts.indexOf(node.identity.toString()) === -1) {
              if (node.labels.indexOf("External") !== -1) {
                  node.labels = "External";
              } else if (node.labels.indexOf("Contract") !== -1) {
                  node.labels = "Contract";
              } else {
                  node.labels = node.labels[0];
              }
              let convertedNode = {
                  "id": node.identity.toString(),
                  "label": node.labels,
                  "properties": node.properties
              };
              addedAccounts.push(node.identity.toString());
              convertedNodes.push(convertedNode);
          }

      }
  }

  return convertedNodes;
};



module.exports = new Neo4jAnalyzer();