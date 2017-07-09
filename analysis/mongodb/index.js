const mongoConnector = require("../../dataextractor/connectors/mongodb/index.js")
const winston = require("winston")
const Web3 = require("web3")
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))
let Promise = require("es6-promise").Promise

let mapFromAddressesToGas = function(){
    for (let i = 0; i < this.transactions.length; i++) {
        emit(this.transactions[i].from, this.transactions[i].gas);
    }
}

let mapFromAddressToValue = function(){
    for (let i = 0; i < this.transactions.length; i++) {
        if(this.transactions[i].value > 0){
            emit(this.transactions[i].from, this.transactions[i].value);
        }
    }
}

let reduceToValueSum = function(key, values){
    return Array.sum(values);
}

let valueFromWeiToEther = function(arr){
    for (let i = 0; i < arr.length; i++) {
        arr[i].value = web3.fromWei(arr[i].value, 'ether').toString();
    }
    return arr
}

let getEntries = function(options){
    return new Promise((resolve, reject) => {
        let collection = mongoConnector.getCollection(options.collection)
        let query = options.resultQuery || {}
        let result = collection.find(query)
        if(options.sortObject){
            result = result.sort(options.sortObject)
        }
        if(options.limit){
            result = result.limit(options.limit)
        }
        result.toArray((err, res) => {
            if(err){
                reject(err)
            } else {
                resolve(res)
            }
        })
    })
}

let jobFromAddressToGasSum = {
    map: mapFromAddressesToGas,
    reduce: reduceToValueSum,
    options: {
        out: {
            replace: 'addressToGasSum'
        }
    },
    resultHandler: getEntries,
    resultHandlerOptions: {
        collection: 'addressToGasSum',
        sortObject: {
            value: -1
        }
    }
}

let jobFromAddressToValueSum = {
    map: mapFromAddressToValue,
    reduce: reduceToValueSum,
    options: {
        out: {
            replace: 'addressToValueSum'
        }
    },
    resultHandler: getEntries,
    resultHandlerOptions: {
        collection: 'addressToValueSum',
        sortObject: {
            value: -1
        }
    },
    postProcessor: valueFromWeiToEther
}

var jobs = [
    jobFromAddressToGasSum,
    jobFromAddressToValueSum
];

var MongoDbAnalyzer = function () {

};

MongoDbAnalyzer.prototype.init = function(){
    return mongoConnector.connect()
}

MongoDbAnalyzer.prototype.getTotalValue = function(address){
    return new Promise((resolve, reject) => {
        mongoConnector.query("addressToValueSum", {
            limit: 1,
            filter: {
                "_id": {
                    $eq: address
                }
            }
        }, (err, result) => {
            if(err){
                reject(err)
            } else {
                if(result){
                    result.value = web3.fromWei(result.value, "ether")
                    resolve(result)   
                } else {
                    resolve({
                        value: -1
                    })
                }
            }
        })
    })
}

MongoDbAnalyzer.prototype.runAnalysis = function(job, settings) {
    if(settings){
        job.resultHandlerOptions.resultQuery = settings.result.query || {}
        job.resultHandlerOptions.limit = settings.result.limit || null
    }
    return new Promise((resolve, reject) => {
        mongoConnector.mapReduce(job.map, job.reduce, job.options)
        .then(result => {
            return job.resultHandler(job.resultHandlerOptions)
        })
        .then(result => {
            if(job.postProcessor){
                resolve(job.postProcessor(result))
            } else {
                resolve(result)
            }
        })
        .catch(error => {
            winston.error(error)
            reject(error)
        })
    })
};

module.exports.ana = new MongoDbAnalyzer();
module.exports.jobs = jobs;