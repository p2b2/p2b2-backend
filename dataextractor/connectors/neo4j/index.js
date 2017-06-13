'use strict';

var Promise = require("es6-promise").Promise;
var neo4j = require('neo4j-driver').v1;
const username = "neo4j";
const password = "p2b2";
const uri = "bolt://localhost:7687";
var session = null;
var driver = null;


var isFunction = function (f) {
    return (typeof f === 'function');
};

var Neo4jConnector = function () {
};

Neo4jConnector.prototype.connect = function () {
    return new Promise((resolve, reject) => {
        let newDriver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        let newSession = newDriver.session();

        // TODO: exception handling. I will continue tomorrow :)
        if (true) {
            driver = newDriver;
            session = newSession;
            resolve(newSession);
        } else {
            reject("error")
        }
    })
};

Neo4jConnector.prototype.disconnect = function () {
    session.close();
    driver.close();
};

Neo4jConnector.prototype.getLastBlock = function (callback) {
    if (!isFunction(callback)) {
        throw new Error("missing callback function parameter")
    } else {
        // TODO: get the transaction with the highest block number. I will continue tomorrow :)
        callback(null, -1);
    }
};

Neo4jConnector.prototype.insert = function (block, callback) {
    if (!isFunction(callback)) {
        throw new Error("missing callback function parameter")
    } else {

        // TODO: change the following hardcoded example. I will continue tomorrow :)
        let accountAddress = '0x482e3a38';
        let accountValue = 34;
        let resultPromise = session.run(
            'CREATE (a:Account {address: $address, value: $value}) RETURN a',
            {address: accountAddress, value: accountValue}
        );

        resultPromise.then(result => {
            let singleRecord = result.records[0];
            let node = singleRecord.get(0);

            console.log(node.properties.name);

            callback(null, result);

        }).catch(err => {
            callback(err, null);
            console.error(err.message)
        });
    }
};

module.exports = new Neo4jConnector();