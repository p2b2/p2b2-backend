'use strict';

var Promise = require("es6-promise").Promise;
const winston = require('winston');
var neo4j = require('neo4j-driver').v1;

// At RisingStack, we usually set the configuration from an environment variable called LOG_LEVEL
// winston.level = process.env.LOG_LEVEL
winston.level = 'debug';

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
        var newDriver = neo4j.driver(uri, neo4j.auth.basic(username, password));
        let newSession = newDriver.session();

        if (newSession._open != true) {
            winston.log('error', 'Neo4jConnector - Driver instantiation failed');
            reject('Driver instantiation failed');
        } else {
            winston.log('info', 'DNeo4jConnector - Driver instantiation succeeded');
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

Neo4jConnector.prototype.disconnect = function () {
    session.close();
    driver.close();
};

Neo4jConnector.prototype.getLastBlock = function (callback) {
    if (!isFunction(callback)) {
        throw new Error("missing callback function parameter")
    } else {
        let resultPromise = session.run('MATCH (n:Block) return MAX(n.name)');

        resultPromise.then(result => {
            let singleRecord = result.records[0];
            let singleResult = singleRecord.get(0);
            let lastBlock = -1;
            if (singleResult) lastBlock = singleResult.low;

            winston.log('debug', 'Neo4jConnector - Last inserted block:', {
                block: lastBlock
            });

            callback(null, lastBlock);
        }).catch(err => {
            winston.log('error', 'Neo4jConnector - Could not get last inserted block:', {
                error: err.message
            });
            callback(err, null);
        });
    }
};

Neo4jConnector.prototype.insert = function (block, callback) {
    if (!isFunction(callback)) {
        throw new Error("missing callback function parameter")
    } else {

     //   console.log(block);

        // TODO: change the following hardcoded example. I will continue tomorrow :)
        let accountAddress = '0x486e34a386';
        let accountValue = 34;

        let query = //  'CREATE (a:Account {address: $address, value: $value}) \n ' +
            'CREATE (b:Block {name: $blockNumber, difficulty: $blockDifficulty, extraData: $blockExtraData, ' +
            'gasLimit: $blockGasLimit, gasUsed: $blockGasUsed, miner: $blockMiner, size: $blockSize, ' +
            'timestamp: $blockTimestamp, totalDifficulty: $blockTotalDifficulty}); ';
        if (block.number > 0) query += 'MATCH (bNew:Block {name: $blockNumber}), (bOld:Block {name: $previousBlockNumber}) CREATE (bOld)-[:Chain ]->(bNew); ';
        query += "RETURN b";

        let params = {
            address: accountAddress,
            value: neo4j.int(accountValue),
            blockNumber: neo4j.int(block.number),
            previousBlockNumber: neo4j.int(block.number-1),
            blockDifficulty: neo4j.int(block.difficulty),
            blockExtraData: block.extraData,
            blockGasLimit: neo4j.int(block.gasLimit),
            blockGasUsed: neo4j.int(block.gasUsed),
            blockMiner: block.miner,
            blockSize: neo4j.int(block.size),
            blockTimestamp: neo4j.int(block.timestamp),
            blockTotalDifficulty: neo4j.int(block.totalDifficulty)
        };

        let resultPromise = session.run(query, params);

        resultPromise.then(result => {
            let singleRecord = result.records[0];
            let node = singleRecord.get(0);

            winston.log('info', 'Neo4jConnector - Insertion succeeded:', {
                result: node.properties.name
            });

            callback(null, result);

        }).catch(err => {
            winston.log('error', 'Neo4jConnector - Insertion failed:', {
                error: err.message
            });
            callback(err, null);
        });
    }
};

module.exports = new Neo4jConnector();