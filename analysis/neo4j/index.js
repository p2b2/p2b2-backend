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
            {address: accountAddress.toLowerCase()}
        );

        resultPromise.then(result => {

            let graphData = convertGraph(result);
           /* let graphData  = {
                "nodes": [{name: "Peter", label: "External", id: 1}, {name: "Michael", label: "External", id: 2},
                    {name: "Neo4j", label: "Contract", id: 3},{name: "Steffen", label: "External", id: 4}],
                "links": [{source: 0, target: 1, type: "KNOWS", since: 2010}, {source: 0, target: 2, type: "FOUNDED"},
                    {source: 1, target: 2, type: "WORKS_ON"}]
            };*/
            resolve(graphData);
        }).catch(error => reject(error));
    })
};


let convertGraph = function (neo4jResponse) {
  let addedAccounts = [];
  let addedLinks = [];
  let convertedGraph = {
      "nodes": [],
      "links": []
  };

  for (let i=0; i < neo4jResponse.records.length; i++) {
      let singleRecord = neo4jResponse.records[i];

      for (let j = 0; j < singleRecord.length; j++) {
          let node = singleRecord.get(j);
          console.log(node);
          if (addedAccounts.indexOf(node.identity) === -1) {
              if (node.labels.indexOf("External") != -1) {
                  node.label = "External";
              } else if (node.labels.indexOf("Contract") != -1) {
                  node.label = "Contract";
              } else {
                  node.label = node.labels[0];
              }
              let convertedNode = {
                  "id": node.properties.address,
                  "labels": node.labels,
                  "properties": node.properties
              };
              addedAccounts.push(node.identity);
              convertedGraph.nodes.push(convertedNode);
          }
      }
  }

  return convertedGraph;
};



module.exports = new Neo4jAnalyzer();