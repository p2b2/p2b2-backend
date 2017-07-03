'use strict';

var express = require('express')
var winston = require('winston')
var Web3 = require('web3')
var web3 = new Web3()
const redis = require('redis')
var client = redis.createClient()

const port = 3000

winston.level = "debug";

let bootstrap = function () {
    let baseApp = express()

    baseApp.all("/:address/*", (req, res, next) => {
        let address = req.params.address || ""
        if(!address.startsWith("0x")){
            address = "0x" + address
        }
        if(web3.isAddress(address)){
            next()
        } else {
            next(new Error(400))
        }
    })

    baseApp.get('/:address', (req, res) => {
        let address = req.params.address
        client.get(address, (error, result) => {
            winston.debug(result)
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

    baseApp.listen(port, ()=>{
        winston.info("Backend listening at port " + port)
    })
}

bootstrap()