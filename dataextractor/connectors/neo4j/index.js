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
        // variable to decide if the transaction should be committed or rolled back
        let success = true;
        // the end result of the transaction
        let transactionResult = null;
        // Create a transaction to run multiple statements
        let tx = session.beginTransaction();

        // TODO: Extract parts of this function into separate functions

        /*********************** Start: inserting block as a node and chaining them with edges *********************/
        // create a Block node
        // run statement in a transaction
        let queryCreateBlock = 'CREATE (b:Block {name: $blockNumber, difficulty: $blockDifficulty, extraData: $blockExtraData, ' +
            'gasLimit: $blockGasLimit, gasUsed: $blockGasUsed, miner: $blockMiner, size: $blockSize, ' +
            'timestamp: $blockTimestamp, totalDifficulty: $blockTotalDifficulty}) RETURN b';
        let paramsCreateBlock = {
            blockNumber: neo4j.int(block.number),
            blockDifficulty: neo4j.int(block.difficulty),
            blockExtraData: block.extraData,
            blockGasLimit: neo4j.int(block.gasLimit),
            blockGasUsed: neo4j.int(block.gasUsed),
            blockMiner: block.miner,
            blockSize: neo4j.int(block.size),
            blockTimestamp: neo4j.int(block.timestamp),
            blockTotalDifficulty: neo4j.int(block.totalDifficulty)
        };
        tx.run(queryCreateBlock, paramsCreateBlock)
            .subscribe({
                onNext: (record) => {
                    transactionResult = record;
                },
                onCompleted: () => {
                 //   session.close();
                },
                onError: (error) => {
                    success = false;
                    winston.log('error', 'Neo4jConnector - Transaction statement failed:', {
                        error: error.message
                    });
                }
            });

        // chain the Block nodes with edges
        // run statement in a transaction
        let queryCreateBlockEdge = 'MATCH (bNew:Block {name: $blockNumber}), (bOld:Block {name: $previousBlockNumber}) ' +
            'CREATE (bOld)-[c:Chain ]->(bNew) RETURN c ';
        let paramsCreateBlockEdge = {
            blockNumber: neo4j.int(block.number),
            previousBlockNumber: neo4j.int(block.number-1)
        };
        tx.run(queryCreateBlockEdge, paramsCreateBlockEdge)
            .subscribe({
                onError: (error) => {
                    success = false;
                    winston.log('error', 'Neo4jConnector - Transaction statement failed:', {
                        error: error.message
                    });
                }
            });
        /*********************** End: inserting block as a node and chaining them with edges *********************/


        /*********************** Start: inserting transactions as edges between accounts/contracts. **********
         * If the accounts/contracts are not created as nodes yet, we have to do it here *********************/
            // TODO: Iterate over the transactions, that are in the block. For each transaction check if the
            // TODO: sending and receiving account/contract are already created as nodes in the graph.
            // TODO: If not create them. Then insert the transactions as edges between the sending and
            // TODO: receiving account/contract: (Account) ---transaction ---> (Account)
            // TODO: Alternatively: (Account) ----out----> (Transaction) ----in----> (Account)

        // create an Account node
        // run statement in a transaction
        let queryCreateAccount = 'CREATE (a:Account {address: $address, value: $value}) RETURN a ';
        let paramsCreateAccount = {
            address: Math.random().toString(),
            value: neo4j.int(35)};
        tx.run(queryCreateAccount, paramsCreateAccount)
            .subscribe({
                onError: (error) => {
                    success = false;
                    winston.log('error', 'Neo4jConnector - Transaction statement failed:', {
                        error: error.message
                    });
                }
            });
        /*********************** End: inserting transactions as edges between accounts/contracts. **************/

        /*********************** Start: committing the transaction. **************/
        //decide if the transaction should be committed or rolled back
        if (success) {
            tx.commit()
                .subscribe({
                    onCompleted: () => {
                        // this transaction is now committed
                        winston.log('info', 'Neo4jConnector - Insertion transaction is now committed:', {
                            result: transactionResult
                        });
                        callback(null, transactionResult);
                    },
                    onError: (error) => {
                        winston.log('error', 'Neo4jConnector - Transaction commit failed:', {
                            error: error.message
                        });
                        tx.rollback();
                        callback(error, null);
                    }
                });
        } else {
            //transaction is rolled black and nothing is created in the database
            winston.log('error', 'Neo4jConnector - Transaction rolled back');
            tx.rollback();
            callback(new Error("At least one statement of the transaction failed!"), null);
        }
        /*********************** End: committing the transaction. **************/
    }
};

module.exports = new Neo4jConnector();