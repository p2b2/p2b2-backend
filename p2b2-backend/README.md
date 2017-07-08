# P2B2 Express back-end

## 1. Prepare your machine (install Redis)
Since we cache the results of analytics in a redis cache, you need to install Redis on your machine `apt install redis-server`

Then start Redis by executing `redis-server`

## 2. Start the back-end

### 2.1 Start the MongoDB
Start the mongodb by executing `sudo service mongod start`

### 2.2 Start Neo4j
Start Neo4j by executing `sudo neo4j start`

###2.3 Start the back-end
Initially you need to execute `npm install` from inside the back-end project directory. If not done already, also execute it for the analytics dependencies.

Then, start the application by executing `node index.js`