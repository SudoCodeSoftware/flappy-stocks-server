var testDataSize = 500;
var testData = [];
var shift = 2.0 * Math.PI * Math.random();
var scale = 0.5;
var currentDataIndex = 0;
var clients = [];

for (var i = 0; i < testDataSize; i++) {
	testData[i] = 0;
}

for (var k = 1; k < 1000; k++) {
	var a = 1000.0 * (Math.random() - 0.5) / k;
	var b = 1000.0 * (Math.random() - 0.5) / k;

	for (var i = 0; i < testDataSize; i++) {
		testData[i] += a * Math.sin(shift + scale * 2.0 * Math.PI * k * i / testDataSize);
		testData[i] += b * Math.cos(shift + scale * 2.0 * Math.PI * k * i / testDataSize);
	}
}

function sendNextPrice() {
	const buf = Buffer.allocUnsafe(8);

	buf.writeDoubleBE(testData[currentDataIndex], 0);
	//Go through all users
	database.collection("users").find({}).toArray(function(err, clientList) {
		if (err) throw err;
		for (var i = 0; i < clientList.length; i++) {
			socket.send([buf], clientList[i].port, clientList[i].address, (err) => {
				if (err != null) {
					console.log("ERROR:", err);
				}
			});
		}
	});

	currentDataIndex = (currentDataIndex + 1) % testDataSize;
}

function checkClientStatus() {
	database.collection("users").deleteMany({lastContact: {$lt: new Date().getTime() - 5000}}, function(err, obj) {
    	if (err) throw err;
    	console.log(obj.result.n + " users deleted");
  });
}

var mongoClient = require('mongodb').MongoClient;
var dbURL = "mongodb://localhost:27017/mydb";

const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

function initDatabase(database) {
	//Delete this once we want data persistence

	database.createCollection("users", function(err, res) {
		if (err) throw err;
		//Delete this once we want data persistence
		//If I try dropping a non-existant database, it has a fit
		//so the easiest way to fix it is to just create it.
		database.collection("users").drop(function(err, delOK) {
		  if (err) throw err;
			database.createCollection("users", function(err, res) {
				if (err) throw err;
			});
		});
	});
}

var database;

mongoClient.connect(dbURL, function(err, db) {
  if (err) throw err;
	database = db;
	initDatabase(database);
});

socket.on('error', (err) => {
	console.log(`server error:\n${err.stack}`);
	socket.close();
});

socket.on('message', (msg, rinfo) => {
	var id = msg.readDoubleBE(0);
	var key = msg.readDoubleBE(8);
	console.log(`server got: ${id} from ${rinfo.address}:${rinfo.port}`);
	//console.log("Server got %d from ${rinfo.address}:${rinfo.port}", msg);

	var newClientObj = {
		address: rinfo.address,
		port: rinfo.port,
		lastContact: new Date().getTime()
	};

	database.collection("users").update({address: rinfo.address}, newClientObj, {
		callback: function(err, result) {
			if (err) throw err;

			if (result === null) {
				database.collection("users").insertOne(myobj, function(err, res) {
				  if (err) throw err;
				  console.log("1 record inserted");
				});
			}
			else {
				console.log("ELAPSED TIME: " + (new Date().getTime() - result.lastContact));
				result.lastContact = new Date().getTime();
				console.log("NEW ELAPSED TIME: " + (new Date().getTime() - result.lastContact));
			}

			console.log("Found:", result);
		},
		upsert: true});

/*
		//Output collection for debugging
		database.collection("users").find({}).toArray(function(err, result) {
    	if (err) throw err;
			console.log("\n\n\n-------------\n\n\n")
			console.log(result);
			console.log("\n\n\n-------------\n\n\n")
  	});*/
});

socket.on('listening', () => {
	const address = socket.address();
	socket.setBroadcast(true);
	console.log(`server listening ${address.address}:${address.port}`);
	setInterval(sendNextPrice, 100);
	setInterval(checkClientStatus, 1000);
});

socket.bind(5149);
// server listening 0.0.0.0:5149
