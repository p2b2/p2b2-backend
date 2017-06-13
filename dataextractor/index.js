const Web3 = require("web3");
var Promise = require("es6-promise").Promise;
const config = require("./config.json");
const mongoConnect = require("./connectors/mongodb/index.js");
const neo4jConnect = require("./connectors/neo4j/index.js");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var connectors = {
	"mongodb": mongoConnect, 
	"neo4j": neo4jConnect
};

var usedConnectors = [];

var connections = [];

for (var i = 0; i < config.connectors.length; i++) {
	var connector = connectors[config.connectors[i]];
	usedConnectors.push(connector);
	connections.push(connector.connect());
}

var cleanBlock = function(block){
	delete block.hash;
	delete block.logsBloom;
	delete block.mixHash;
	delete block.nonce;
	delete block.parentHash;
	delete block.receiptsRoot;
	delete block.sha3Uncles;
	delete block.stateRoot;
	delete block.transactionsRoot;
	delete block.uncles;
	delete block._id;
	block.difficulty = block.difficulty.toNumber();
	block.totalDifficulty = block.totalDifficulty.toNumber();
	for (var i = 0; i < block.transactions.length; i++) {
		delete block.transactions[i].blockHash;
		delete block.transactions[i].hash;
		delete block.transactions[i].nonce;
		delete block.transactions[i].v;
		delete block.transactions[i].r;
		delete block.transactions[i].s;
		block.transactions[i].gasPrice = block.transactions[i].gasPrice.toNumber()
		block.transactions[i].value = block.transactions[i].value.toNumber()
	}
};

var insertBlock = function(blockNr, connector, cb){
	web3.eth.getBlock(blockNr, true, (err, block) => {
		if(err){
			cb(err, null, connector)
		} else if(block !== null){
			cleanBlock(block);
			connector.insert(block, (error, res) =>{
				if(error)
					cb(error);
				else
					console.log("Inserted block " + blockNr);
					cb(null, blockNr + 1, connector)
			})
		} else {
			cb(null, -1, connector)
		}
	})
};

var blockInserted = function(err, nextBlock, connector){
	if(err){
		console.error(err.message);
		connector.disconnect()
	} else {
		if(nextBlock > 0){
			insertBlock(nextBlock, connector, blockInserted)
		} else {
			connector.disconnect();
			console.log("Stopped inserting blocks")
		}
	}
};

var insertBlocks = function(res) {
	for (var i = 0; i < usedConnectors.length; i++) {
		var connector = usedConnectors[i];
		connector.getLastBlock((error, lastBlock) => {
			if(error){
				console.error(error.message)
			} else {
				var firstBlock = lastBlock + 1;
				insertBlock(firstBlock, connector, blockInserted);
			}
		})
		
	}
};

Promise.all(connections).then(insertBlocks).catch(err => {
	console.error(err.message)
});