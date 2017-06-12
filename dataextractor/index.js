const Web3 = require("web3");
const mongoConnect = require("./connectors/mongodb/index.js");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

mongoConnect.connect((err, res) => {
	if(!err){
		for (var i = 48000; i < 49000; i++) {
		    web3.eth.getBlock(i, true, (error, result) => {
		        if(error){
		            console.error(error)
		        } else {
					mongoConnect.insert(result,(error, block) => {
						if(error)
							console.error(error)
						else
							console.log(block)
					});
		        }
		    })
		}	
	}
})