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

/**
 * Computes the 10 accounts with the highest degree centrality
 * @returns {Promise}
 */
Neo4jAnalyzer.prototype.getAccountDegreeCentrality = () => {
    return new Promise((resolve, reject) => {
        let resultPromise = session.run(
            'match (n:Account)-[r:Transaction]-(m:Account) ' +
            'return n.address, count(r) as DegreeScore ' +
            'order by DegreeScore desc ' +
            'limit 10;'
        );

        Promise.all([resultPromise]).then(promisesResult => {
            resolve(promisesResult[0]);
        }).catch(promisesError => {
            reject(promisesError);
        });
    })
};

/**
 * Computes the 10 external accounts with the highest degree centrality
 * @returns {Promise}
 */
Neo4jAnalyzer.prototype.getExternalDegreeCentrality = () => {
    return new Promise((resolve, reject) => {
        let resultPromise = session.run(
            'match (n:External)-[r:Transaction]-(m:Account) ' +
            'return n.address, count(r) as DegreeScore ' +
            'order by DegreeScore desc ' +
            'limit 10;'
        );

        Promise.all([resultPromise]).then(promisesResult => {
            resolve(promisesResult[0]);
        }).catch(promisesError => {
            reject(promisesError);
        });
    })
};

/**
 * Computes the 10 contracts with the highest degree centrality
 * @returns {Promise}
 */
Neo4jAnalyzer.prototype.getContractDegreeCentrality = () => {
    return new Promise((resolve, reject) => {
        let resultPromise = session.run(
            'match (n:Contract)-[r:Transaction]-(m:Account) ' +
            'return n.address, count(r) as DegreeScore ' +
            'order by DegreeScore desc ' +
            'limit 10;'
        );

        Promise.all([resultPromise]).then(promisesResult => {
            resolve(promisesResult[0]);
        }).catch(promisesError => {
            reject(promisesError);
        });
    })
};


/**
 * Computes the 10 accounts with the highest betweenness centrality
 * Only use on a machine with high memory resources
 * @returns {Promise}
 */
Neo4jAnalyzer.prototype.getAccountBetweennessCentrality = () => {
    return new Promise((resolve, reject) => {
        let resultPromise = session.run(
            'MATCH p=allShortestPaths((source:Account)-[:Transaction*]-(target:Account)) ' +
            'WHERE id(source) < id(target) and length(p) > 1 ' +
            'UNWIND nodes(p)[1..-1] as n ' +
            'RETURN n.address, count(*) as betweenness ' +
            'ORDER BY betweenness DESC'
        );

        Promise.all([resultPromise]).then(promisesResult => {
            resolve(promisesResult[0]);
        }).catch(promisesError => {
            reject(promisesError);
        });
    })
};

/**
 * Computes a graph for a list of provided accounts. The links in the created graph are limited to 10 because of
 * computing power reasons.
 * @returns {Promise}
 */
Neo4jAnalyzer.prototype.getGraphForAccounts = (accounts) => {
    return new Promise((resolve, reject) => {
        let params = {};
        let query = 'MATCH (n:Account) ' +
            'WHERE n.address= $address ';
        for (let i =0; i< accounts.length;i++) {
            params["address"+i] = accounts[i];
            if (i>0) query = query +' OR n.address= $address' + i;
        }
        query = query + ' RETURN n ';

        let resultPromise = session.run(query, params);

        Promise.all([resultPromise]).then(promisesResult => {
            resolve(promisesResult[0]);
        }).catch(promisesError => {
            reject(promisesError);
        });
    })
};

Neo4jAnalyzer.prototype.getGraphForAccount = (accountAddress) => {
    return new Promise((resolve, reject) => {
        let nodesResultPromise = session.run(
            'MATCH (accountOne:Account) WHERE accountOne.address=$address ' +
            'MATCH (neighbors) ' +
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

        let linksResultPromise = session.run(
             'MATCH (:Account {address: $address})-[r]-() ' +
             'RETURN r ',
            // + 'LIMIT 500',
            {address: accountAddress.toLowerCase()}
        );

        Promise.all([linksResultPromise, nodesResultPromise]).then(promisesResult => {
            let graphData = convertGraph(promisesResult[1], promisesResult[0]);
            resolve(graphData);
        }).catch(promisesError => {
            reject(promisesError);
        });
    })
};

let convertGraph = function (neo4jNodeResponse, neo4jLinkResponse) {
    let convertedGraphNodes =  convertGraphNodes(neo4jNodeResponse);
    let convertedGraphLinks =  convertGraphLinks(neo4jLinkResponse);

    for (let i = 0; i < convertedGraphLinks.length; i++) {
        for (let j = 0; j< convertedGraphNodes.length; j++) {
            if (convertedGraphLinks[i].source === convertedGraphNodes[j].id) convertedGraphLinks[i].source = j;
            if (convertedGraphLinks[i].target === convertedGraphNodes[j].id) convertedGraphLinks[i].target = j;
        }
    }

    return {
        "nodes": convertedGraphNodes,
        "links": convertedGraphLinks
    };
};

let convertGraphLinks = function (neo4jLinkResponse) {
    let addedLinks = [];
    let convertedLinks = [];

    for (let i=0; i < neo4jLinkResponse.records.length; i++) {
        let singleRecord = neo4jLinkResponse.records[i];
        for (let j = 0; j < singleRecord.length; j++) {
            let link =  singleRecord.get(j);
            if (addedLinks.indexOf(link.identity.toString()) === -1) {
                let convertedLink = null;
                if (link.type === "Transaction") {
                    link.properties = {
                        input: link.properties.input,
                        blockNumber: link.properties.blockNumber.toString(),
                        gas: link.properties.gas.toString(),
                        from: link.properties.from,
                        transactionIndex: link.properties.transactionIndex.toString(),
                        to: link.properties.to,
                        value: link.properties.value.toString(),
                        gasPrice: link.properties.gasPrice.toString()
                    };
                    convertedLink = {
                        "id": link.identity.toString(),
                        "source": link.start.toString(),
                        "target": link.end.toString(),
                        "type": link.type,
                        "properties": link.properties
                    };
                } else if (link.type === "Mined") {
                    convertedLink = {
                        "id": link.identity.toString(),
                        "source": link.start.toString(),
                        "target": link.end.toString(),
                        "type": link.type
                    };
                }
                if (convertedLink!== null) {
                    addedLinks.push(link.identity.toString());
                    convertedLinks.push(convertedLink);
                }
            }
        }
    }
    console.log(convertedLinks);
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
              } else if (node.labels.indexOf("Block") !== -1) {
                  node.labels = "Block";
                  node.properties.blockNumber = node.properties.blockNumber.toString()
              } else {
                  node.labels = node.labels[0];
              }
              let convertedNode = {
                  "id": node.identity.toString(),
                  "index": node.identity.toString(),
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