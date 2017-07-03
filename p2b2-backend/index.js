'use strict';

var express = require('express')
var winston = require('winston')
var anaMongoTotal = require('../analysis/mongodb/index.js')
var anaMongo = anaMongoTotal.ana
var anaNeo4J = require('../analysis/neo4j/index.js')
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

let bootstrap = function () {
    let baseApp = express()

    baseApp.get('/:address', validateAddress, (req, res) => {
        let address = req.params.address
        client.get(address, (error, result) => {
            if(error){
                res.send(error)
            } else {
                if(!result){
                    res.send('Nothing found')
                    client.set(address, "Address: " + address, redis.print)
                } else {
                    res.send(result)
                }
            }
        })
    })

    baseApp.get('/:address/totalValue', validateAddress, (req, res) => {
        let address = req.params.address
        client.get("totalValue:" + address, (error, result) => {
            if(error){
                res.send(error)
            } else {
                if(!result){
                    anaMongo.runAnalysis(anaMongoTotal.jobs[1], {
                        mapQuery: {"transactions.from": {
                            $eq: address}
                        },
                        resultQuery: {
                            "_id": address
                        }
                    })
                    .then(totalValue => {
                            let value = totalValue[0].value || "0 ether"
                            res.send(value)
                            client.set("totalValue:" + address, value, redis.print)
                        }
                    )
                    .catch(error => {
                        res.send(error)
                    })
                } else {
                    winston.info("Read from cache: " , result)
                    res.send(result)
                }
            }
        })
    })

    baseApp.listen(port, ()=>{
        winston.info("Backend listening at port " + port)
    })
}

bootstrap()