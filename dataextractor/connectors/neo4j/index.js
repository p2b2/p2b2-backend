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

var isFunction = (f) => {
    return (typeof f === 'function');
};

var Neo4jConnector = function () {
};

Neo4jConnector.prototype.connect = () => {
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

Neo4jConnector.prototype.disconnect = () => {
    session.close();
    driver.close();
};

Neo4jConnector.prototype.getLastBlock = (callback) => {
    if (!isFunction(callback)) {
        throw new Error("missing callback function parameter")
    } else {
        let resultPromise = session.run('MATCH (n:Block) return MAX(n.name)');

        resultPromise.then(result => {
            let singleRecord = result.records[0];
            let singleResult = singleRecord.get(0);
            //  let lastBlock = -1;
            let lastBlock = 100000;
            if (singleResult) lastBlock = singleResult.low;

            winston.log('debug', 'Neo4jConnector - Last inserted block:', {
                block: lastBlock
            });

            // TODO: if lastBlock == -1 create database scheme (uniqueness of accounts and blocks etc.)

            callback(null, lastBlock);
        }).catch(err => {
            winston.log('error', 'Neo4jConnector - Could not get last inserted block:', {
                error: err.message
            });
            callback(err, null);
        });
    }
};

Neo4jConnector.prototype.insert = (block, callback) => {
    if (!isFunction(callback)) {
        throw new Error("missing callback function parameter")
    } else {
        // variable to decide if the transaction should be committed or rolled back
        let success = true;
        // the end result of the transaction
        let transactionResult = null;
        // Create a transaction to run multiple statements
        let tx = session.beginTransaction();

        /*********************** inserting block as a node and chaining them with edges **************/
        createBlocks(tx, block, (err, res) => {
            if (res) transactionResult = res; else success = false;
            /*********************** chaining blocks with edges **************/
            chainBlocks(tx, block, (err, res) => {
                if (err) success = false;

                /*********************** Inserting transactions as edges between accounts/contracts. **********/
                    // Iterate over the transactions, that are in the block.
                let transactionPromises = [];
                for (let transaction of block.transactions) {
                    transactionPromises.push(insertTransaction(tx, transaction));
                }

                /*********************** committing the transaction. **************/
                Promise.all(transactionPromises).then(() => {
                    // This will commit the transaction
                    commitTransaction(tx, success, (err, res) => {
                        if (res) callback(null, transactionResult); else callback(err, null);
                    });
                }).catch(err => {
                    // This will roll back the transaction
                    success = false;
                    commitTransaction(tx, success, (err, res) => {
                        if (res) callback(null, transactionResult); else callback(err, null);
                    });
                });
            });
        });
    }
};

/****************************************************************
 *** Start: Functions used to insert the blocks in the graph. ***
 ****************************************************************/

/**
 * Creates a Block as a node in the graph database
 * @param tx
 * @param block
 * @param callback
 */
var createBlocks = (tx, block, callback) => {
    let transactionResult = null;
    // create a Block node
    // run statement in a transaction
    let queryCreateBlock = 'CREATE (b:Block {name: $blockNumber, difficulty: $blockDifficulty, extraData: $blockExtraData, ' +
        'gasLimit: $blockGasLimit, gasUsed: $blockGasUsed, miner: $blockMiner, size: $blockSize, ' +
        'timestamp: $blockTimestamp, totalDifficulty: $blockTotalDifficulty}) RETURN b LIMIT 1';
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
                winston.log('debug', 'Neo4jConnector - New block node created', {
                    // node: record
                });
                callback(null, transactionResult);
            },
            onCompleted: () => {
                //   session.close();
            },
            onError: (error) => {
                winston.log('error', 'Neo4jConnector - Transaction statement failed:', {
                    error: error.message
                });
                callback(error, null);
            }
        });
};

/**
 * Creates edges from one block-node the its predecessor
 * @param tx
 * @param block
 * @param callback
 */
var chainBlocks = (tx, block, callback) => {
    // chain the Block nodes with edges
    // run statement in a transaction
    let queryCreateBlockEdge = 'MATCH (bNew:Block {name: $blockNumber}), (bOld:Block {name: $previousBlockNumber}) ' +
        'CREATE (bOld)-[c:Chain ]->(bNew) RETURN c LIMIT 1 ';
    let paramsCreateBlockEdge = {
        blockNumber: neo4j.int(block.number),
        previousBlockNumber: neo4j.int(block.number - 1)
    };
    tx.run(queryCreateBlockEdge, paramsCreateBlockEdge)
        .subscribe({
            onNext: (record) => {
                winston.log('debug', 'Neo4jConnector - New block chained to the last one', {
                    //edge: record
                });
                callback(null, record);
            },
            onError: (error) => {
                winston.log('error', 'Neo4jConnector - Transaction statement failed:', {
                    error: error.message
                });
                callback(error, null);
            }
        });
};

/**
 * Inserts a transaction to the graph database. To do so it first checks if the required accounts/contracts already
 * exist as nodes in the database and if not, creates them. Then it inserts the transaction itself as edges between
 * accounts/contracts.
 * @param tx
 * @param transaction
 * @returns {Promise}
 */
var insertTransaction = (tx, transaction) => {
    /*********** If the accounts/contracts are not created as nodes yet, we have to do it here ************/
    // TODO: check if the sending and receiving account/contract are already created as nodes in the graph.
    // TODO: If not create them. Then insert the transactions as edges between the sending and
    // TODO: receiving account/contract: (Account) ---transaction ---> (Account)
    // TODO: Alternatively: (Account) ----out----> (Transaction) ----in----> (Account)
    return new Promise((resolve, reject) => {

        resolve(true);
        reject('Blaaaa');
    })
};

/**
 * If the success parameter is true, it commits the transaction. If not, it rolls it back.
 * @param tx
 * @param success
 * @param callback
 */
var commitTransaction = (tx, success, callback) => {
    //decide if the transaction should be committed or rolled back
    if (success) {
        tx.commit()
            .subscribe({
                onCompleted: () => {
                    // this transaction is now committed
                    winston.log('debug', 'Neo4jConnector - Transaction is now committed', {
                        //result: transactionResult
                    });
                    callback(null, true);
                },
                onError: (error) => {
                    winston.log('error', 'Neo4jConnector - Transaction commit failed, rollback!', {
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
};

/****************************************************************
 **** End: Functions used to insert the blocks in the graph. ****
 ****************************************************************/

module.exports = new Neo4jConnector();