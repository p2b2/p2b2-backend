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
        // TODO: get graph for the provided account address
        let graphData  = {
            "nodes": [{name: "Peter", label: "External", id: 1}, {name: "Michael", label: "External", id: 2},
                {name: "Neo4j", label: "Contract", id: 3},{name: "Steffen", label: "External", id: 4}],
            "links": [{source: 0, target: 1, type: "KNOWS", since: 2010}, {source: 0, target: 2, type: "FOUNDED"},
                {source: 1, target: 2, type: "WORKS_ON"}]
        };
        resolve(graphData);
    })
};



module.exports = new Neo4jAnalyzer();