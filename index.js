'use strict';

var express = require('express')
const winston = require('winston')
var SHA256 = require("crypto-js/sha256");
var anaMongoTotal = require('p2b2-analysis-mongodb')
var anaMongo = anaMongoTotal.ana
var anaNeo4J = require('p2b2-analysis-neo4j')
var Web3 = require('web3')
var web3 = new Web3()
const redis = require('redis')

var client = redis.createClient()
const port = 3000

winston.level = "debug";

client.on("error", err => {
    winston.error(err)
})

let validateAddress = (req, res, next) => {
    let address = req.params.address || ""
    if(!address.startsWith("0x")){
        address = "0x" + address
    }
    if(web3.isAddress(address)){
        next()
    } else {
        res.status(400).send(req.params.address + " is not a valid Ethereum address!")
    }
}


let validateDegreeCentralityContext = (req, res, next) => {
    let context = req.params.context || "";
    if(context !== "accounts" && context !== "external" && context !== "contracts" ){
        res.status(400).send(req.params.context + " is not a valid context for the degree centrality. Must be either 'accounts', 'external' or 'contracts'")
    } else {
        next()
    }
}

let bootstrap = function () {
    let baseApp = express()

    baseApp.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    /***************************************
     * Start: Graph DB requests
     ***************************************/
    baseApp.get('/graph/:address', validateAddress, (req, res) => {
        let addressGraph = "graph-" + req.params.address ;
        client.get(addressGraph, (error, result) => {
            if(error){
                res.send(error)
            } else {
                if(!result){
                    //if(!false){
                    // TODO: if the cached record is bigger than a certain time threshold, get it new from Neo4j
                    anaNeo4J.getGraphForAccount(req.params.address).then(graph => {
                        let graphData = graph;
                        client.set(addressGraph, JSON.stringify(graphData), redis.print);
                        res.send(graphData);
                    }).catch(err => {
                        winston.log('error', 'P2B2backend - Could not fetch Graph for account', err);
                        res.status(400).send('Something broke!');
                    });
                } else {
                    res.send(result)
                }
            }
        })
    });

    // TODO implement a validate function
    baseApp.get('/analytics/graph/accounts', (req, res) => {
        let addresses =  req.query.addresses;
        let addressGraph = "graph-" + SHA256(req.query.addresses);
        client.get(addressGraph, (error, result) => {
            if(error){
                res.send(error)
            } else {
                if(!result){
               // if(!false){
                    // TODO: if the cached record is bigger than a certain time threshold, get it new from Neo4j
                    anaNeo4J.getGraphForAccounts(addresses).then(graph => {
                        let graphData = graph;
                        client.set(addressGraph, JSON.stringify(graphData), redis.print);
                        res.send(graphData);
                    }).catch(err => {
                        winston.log('error', 'P2B2backend - Could not fetch Graph for accounts', err);
                        res.status(400).send('Something broke!');
                    });
                } else {
                    res.send(result)
                }
            }
        })
    });

    baseApp.get('/graph/degreecentrality/:context', validateDegreeCentralityContext, (req, res) => {
        let context = req.params.context;
        let addressGraph = "graph-degreecentrality:"+context ;
        client.get(addressGraph, (error, result) => {
            if(error){
                res.send(error)
            } else {
                 if(!result){
                //if(!false){
                    // TODO: if the cached record is bigger than a certain time threshold, get it new from Neo4j
                    let centralityPromise = null;
                    if (context === "accounts") {
                        centralityPromise = anaNeo4J.getAccountDegreeCentrality();
                    } else if (context === "external") {
                        centralityPromise = anaNeo4J.getExternalDegreeCentrality();
                    } else if (context === "contracts") {
                        centralityPromise = anaNeo4J.getContractDegreeCentrality();
                    }

                    centralityPromise.then(degreeCentralityResult => {
                        client.set(addressGraph, JSON.stringify(degreeCentralityResult), redis.print);
                        res.send(degreeCentralityResult);
                    }).catch(err => {
                        winston.log('error', 'P2B2backend - Could not fetch Graph degree centrality', err);
                        res.status(400).send('Something broke!');
                    });
                } else {
                    res.send(result)
                }
            }
        })
    });

    /***************************************
     * End: Graph DB requests
     ***************************************/

    baseApp.put('/jobs', (req, res) => {
        let promises = []
        for (var i = 0; i < anaMongoTotal.jobs.length; i++) {
            promises.push(anaMongo.runAnalysis(anaMongoTotal.jobs[i]))
        }
        Promise.all(promises).then.then(result => {
            winston.info("MR JOBS FINISHED!")
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })
    })

    baseApp.put('/totalValueSent', (req, res) => {
        anaMongo.runAnalysis(anaMongoTotal.jobs[1]).then(result => {
            winston.info("MR JOB FINISHED!")
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })
    })

    baseApp.put('/totalValueReceived', (req, res) => {
        anaMongo.runAnalysis(anaMongoTotal.jobs[2]).then(result => {
            winston.info("MR JOB FINISHED!")
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })
    })

    baseApp.put('/topGasRevenue', (req, res) => {
        anaMongo.runAnalysis(anaMongoTotal.jobs[3]).then(result => {
            winston.info("MR JOB FINISHED!")
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })
    })

    baseApp.put('/rankings', (req, res) => {
        anaMongo.runAnalysis(anaMongoTotal.jobs[1]).then(result => {
            winston.info("MR JOB FINISHED!")
            res.sendStatus(200)
        })
        anaMongo.runAnalysis(anaMongoTotal.jobs[2]).then(result => {
            winston.info("MR JOB FINISHED!")
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })
        anaMongo.runAnalysis(anaMongoTotal.jobs[3]).then(result => {
            winston.info("MR JOB FINISHED!")
            res.sendStatus(200)
        }).catch(error => {
            res.sendStatus(500)
        })
    })

    baseApp.get('/topRevenueSent', (req, res) => {
        let limit = parseInt(req.query.limit, 10) || 3
        client.get("topRevenueSent", (error, result) => {
            if(error){
                res.send(error)
                return;
            }
            if(!result){
                anaMongo.getTopRevenueSent(limit).then(result => {
                    res.send(result)
                    client.set("topRevenueSent", JSON.stringify(result), redis.print)
                }).catch(error => {
                    winston.error(error)
                    res.sendStatus(500)
                })
            } else {
                res.send(JSON.parse(result))
            }
        })
    })

    baseApp.get('/topRevenueReceived', (req, res) => {
        let limit = parseInt(req.query.limit, 10) || 3
        client.get("topRevenueReceived", (error, result) => {
            if(error){
                res.send(error)
                return;
            }
            if(!result){
                anaMongo.getTopRevenueReceived(limit).then(result => {
                    res.send(result)
                    client.set("topRevenueReceived", JSON.stringify(result), redis.print)
                }).catch(error => {
                    winston.error(error)
                    res.sendStatus(500)
                })
            } else {
                res.send(JSON.parse(result))
            }
        })
    })

    baseApp.get('/topGasRevenue', (req, res) => {
        let limit = parseInt(req.query.limit, 10) || 3
        client.get("topGasRevenue", (error, result) => {
            if(error){
                res.send(error)
                return;
            }
            if(!result){
                anaMongo.getTopGasRevenue(limit).then(result => {
                    res.send(result)
                    client.set("topGasRevenue", JSON.stringify(result), redis.print)
                }).catch(error => {
                    winston.error(error)
                    res.sendStatus(500)
                })
            } else {
                res.send(JSON.parse(result))
            }
        })
    })

    baseApp.get('/:address/totalValue', validateAddress, (req, res) => {
        let address = req.params.address

        let totalValueKey = "totalValue:" + address;
        client.get(totalValueKey, (error, result) => {
            if(error){
                res.send(error)
            } else {
                if(!result){
                    anaMongo.getTotalValue(address).then(result => {
                        res.status(200).send(result)
                    }).catch(error => {
                        winston.error(error)
                        res.sendStatus(500)
                    })                            
                } else {
                    winston.info("Read from cache: " , result)
                    res.send({
                        value: result
                    })
                }
            }
        })
    })

    baseApp.listen(port, ()=>{
        winston.info("Backend listening at port " + port)
    })

    winston.info("Backend started" )
}

let promiseArray = [anaMongo.init(), anaNeo4J.connect()]
Promise.all(promiseArray).then(bootstrap).catch(err => {
    winston.log('error', 'P2B2backend - could not establish connection to the database:', {
        error: err.message
    });
});