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
        arr[i].value = web3.fromWei(arr[i].value, 'ether') + ' ether';
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
        },
        limit: 1
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
        },
        limit: 1
    },
    postProcessor: valueFromWeiToEther
}

var jobs = [
    jobFromAddressToGasSum,
    jobFromAddressToValueSum
];

var MongoDbAnalyzer = function () {
};

MongoDbAnalyzer.prototype.runAnalysis = function(job, settings) {
    if(settings){
        if(settings.mapQuery){
            job.options.query = settings.mapQuery
        }
        if(settings.resultQuery){
            job.resultHandlerOptions.resultQuery = settings.resultQuery
        }
    }
    return new Promise((resolve, reject) => {
        mongoConnector.connect()
        .then(() => {
            return mongoConnector.mapReduce(job.map, job.reduce, job.options)
        })
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