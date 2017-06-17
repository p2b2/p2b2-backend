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
// TODO change back
// var startBlock = -1;
var startBlock = 1000000;

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
        let resultPromise = session.run('MATCH (n:Block) return MAX(n.blockNumber)');

        resultPromise.then(result => {
            let singleRecord = result.records[0];
            let singleResult = singleRecord.get(0);
            let lastBlock = startBlock;
            if (singleResult) lastBlock = singleResult.low;

            winston.log('debug', 'Neo4jConnector - Last inserted block:', {
                block: lastBlock
            });

            // TODO: if lastBlock == -1 create database scheme (uniqueness of accounts and blocks etc.)
            // TODO: CREATE CONSTRAINT ON (account:Account) ASSERT account.address IS UNIQUE;
            // TODO: CREATE CONSTRAINT ON (contract:Contract) ASSERT contract.address IS UNIQUE

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
                let checkedAccounts = {accounts: []};
                for (let transaction of block.transactions) {
                    transactionPromises.push(insertTransaction(tx, transaction, checkedAccounts));
                }

                /*********************** committing the transaction. **************/
                if (transactionPromises.length === 0) {
                    // This will commit the transaction
                    commitTransaction(tx, success, block, (err, res) => {
                        if (res) callback(null, transactionResult); else callback(err, null);
                    });
                } else {
                    Promise.all(transactionPromises).then(() => {
                        // This will commit the transaction
                        commitTransaction(tx, success, block, (err, res) => {
                            if (res) callback(null, transactionResult); else callback(err, null);
                        });
                    }).catch(err => {
                        // This will roll back the transaction
                        success = false;
                        commitTransaction(tx, success, block, (err, res) => {
                            if (res) callback(null, transactionResult); else callback(err, null);
                        });
                    });
                }
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
    let queryCreateBlock = 'CREATE (b:Block {blockNumber: $blockNumber, difficulty: $blockDifficulty, extraData: $blockExtraData, ' +
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
    if (block.number === (startBlock + 1)) {
        callback(null, true);
    } else {
        // chain the Block nodes with edges
        // run statement in a transaction
        let queryCreateBlockEdge = 'MATCH (bNew:Block {blockNumber: $blockNumber}), (bOld:Block {blockNumber: $previousBlockNumber}) ' +
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
    }
};

/**
 * Inserts a transaction to the graph database. To do so it first checks if the required accounts/contracts already
 * exist as nodes in the database and if not, creates them. Then it inserts the transaction itself as edges between
 * accounts/contracts.
 * @param tx
 * @param transaction
 * @returns {Promise}
 */
var insertTransaction = (tx, transaction, checkedAccounts) => {
    /*********** If the accounts/contracts are not created as nodes yet, we have to do it here ************/
    return new Promise((resolve, reject) => {
        // check if the sending and receiving account/contract are already created as nodes in the graph. If not create them.

        // This array contains the accounts that need to be created, because so far they do no exist in the graph
        let accountsArray = [];

        /*********************** Checks if the FROM account exists **************/
        checkAccountExistence(tx, transaction.from, checkedAccounts, (err, res) => {
            if (err) reject(err); else {
                if (res === false) accountsArray.push({address: transaction.from, contract: false});
                /*********************** Checks if the TO account exists **************/
                checkAccountExistence(tx, transaction.to, checkedAccounts, (err, res) => {
                    if (err) reject(err); else {
                        let toAccountIsContract = false;
                        // TODO use regex instead
                        if (transaction.input !== '0x') toAccountIsContract = true;
                        if (transaction.to !== null) {
                            // the TO address is null on contract creation
                            if (res === false) accountsArray.push({
                                address: transaction.to,
                                contract: toAccountIsContract
                            });
                        }
                        /*********************** create the accounts if not existing **************/
                        createAccounts(tx, accountsArray, (err, res) => {
                            if (err) reject(err); else {

                                /*********************** Insert transactions as edges **************/
                                // TODO: Insert the transactions as edges between the sending and
                                // TODO: receiving account/contract: (Account) ---transaction ---> (Account)
                                // TODO: Alternatively: (Account) ----out----> (Transaction) ----in----> (Account)
                                insertTransactionEdge(tx, transaction, (err, res) => {
                                    if (err) reject(err); else {
                                        resolve(transaction);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    })
};

var checkAccountExistence = (tx, accountAddress, checkedAccounts, callback) => {
    if (checkedAccounts.accounts.indexOf(accountAddress) !== -1) {
        callback(null, true);
    } else {
        checkedAccounts.accounts.push(accountAddress);
        tx.run("MATCH (n) WHERE n.address = $address RETURN count(n)", {address: accountAddress})
            .subscribe({
                onNext: (record) => {
                    if (record.get(0).low === 0) {
                        // from account needs to be created
                        //winston.log('debug', 'Neo4jConnector - Account existance check done:', {exists: false, address:accountAddress});
                        callback(null, false);
                    } else if (record.get(0).low === 1) {
                        // account or contract already exists
                        //winston.log('debug', 'Neo4jConnector - Account existance check done:', {exists: true, address:accountAddress});
                        callback(null, true);
                    } else if (record.get(0).low > 1) {
                        // Error: database is corrupted (multiple nodes nodes with same address exist)
                        winston.log('error', 'Neo4jConnector - database is corrupted (multiple nodes nodes with same address exist)');
                        callback(new Error("Database is corrupted (multiple nodes nodes with same address exist)"), null);
                    }
                },
                onError: (error) => {
                    winston.log('error', 'Neo4jConnector - ???:', {
                        error: error.message
                    });
                    callback(error, null);
                }
            });
    }
};

/**
 *
 * @param tx The Neo4j session transaction
 * @param accounts Is expecting an array in the following form:
 *                  [{address: '0x52a31...', contract: false}, {address: '0x2e315...', contract: true}]
 */
var createAccounts = (tx, accounts, callback) => {
    let query;
    let params;
    if (accounts.length === 1) {
        query = "CREATE (a:";
        if (accounts[0].contract) query = query + "Contract"; else query = query + "Account";
        query = query + " {address: $address}) RETURN a";
        params = {address: accounts[0].address};
    } else if (accounts.length === 2) {
        query = "CREATE (a:";
        if (accounts[0].contract) query = query + "Contract"; else query = query + "Account";
        query = query + " {address: $address}) CREATE (a2:";
        if (accounts[1].contract) query = query + "Contract"; else query = query + "Account";
        query = query + " {address: $address2}) RETURN a";
        params = {address: accounts[0].address, address2: accounts[1].address};
    } else if (accounts.length === 0) {
        callback(null, true);
    } else {
        winston.log('error', 'Neo4jConnector - Invalid number of accounts to create!');
        callback(new Error("Invalid number of accounts to create!"), null);
    }

    if (accounts.length === 1 || accounts.length === 2) {
        // create an Account node
        tx.run(query, params).subscribe({
            onNext: (record) => {
                winston.log('debug', 'Neo4jConnector - New account node(s) created', {accounts: accounts});
                callback(null, record);
            },
            onError: (error) => {
                winston.log('error', 'Neo4jConnector - Transaction statement failed', {
                    error: error
                });
                callback(error, null);

            }
        });
    }
};

/**
 * Creates edges from one block-node the its predecessor
 * @param tx
 * @param block
 * @param callback
 */
var insertTransactionEdge = (tx, transaction, callback) => {
    console.log("need resolve");
    console.log(transaction);
    // chain the account/contract nodes with edges representing the transaction
    let queryCreateTransactionEdge = 'MATCH (aFrom {address: $fromAddress}), (aTo {address: $toAddress}) ' +
        'CREATE (aFrom)-[t:Transaction { to: $toAddress, from: $fromAddress,  ' +
        'blockNumber: $blockNumber, transactionIndex: $transactionIndex, value: $value, gas: $gas, ' +
        'gasPrice: $gasPrice, input: $input}]->(aTo) RETURN t LIMIT 1 ';
    let paramsCreateTransactionEdge = {
        fromAddress: transaction.from,
        toAddress: transaction.to,
        blockNumber: neo4j.int(transaction.blockNumber),
        transactionIndex: neo4j.int(transaction.transactionIndex),
        value: neo4j.int(transaction.value.toString(10)), // value is a web3 BigNumber
        gas: neo4j.int(transaction.gas),
        gasPrice: neo4j.int(transaction.gasPrice.toString(10)), // gas price is a web3 BigNumber
        input: transaction.input,
    };
    tx.run(queryCreateTransactionEdge, paramsCreateTransactionEdge)
        .subscribe({
            onNext: (record) => {
                winston.log('debug', 'Neo4jConnector - New edge between accounts inserted representing a transaction', {
                    //edge: record
                });
                console.log("resolve");
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
 * If the success parameter is true, it commits the transaction. If not, it rolls it back.
 * @param tx
 * @param success
 * @param callback
 */
var commitTransaction = (tx, success, block, callback) => {
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
        winston.log('error', 'Neo4jConnector - Transaction rolled back', {
            block: block
        });
        tx.rollback();
        callback(new Error("At least one statement of the transaction failed!"), null);
    }
};

/****************************************************************
 **** End: Functions used to insert the blocks in the graph. ****
 ****************************************************************/

module.exports = new Neo4jConnector();