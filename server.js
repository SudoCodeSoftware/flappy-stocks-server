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

	for (var clientI = 0; clientI < clients.length; clientI++) {
		socket.send([buf], clients[clientI].port, clients[clientI].address, (err) => {
			if (err != null) {
				console.log("ERROR:", err);
			}
		});
	}

	currentDataIndex = (currentDataIndex + 1) % testDataSize;
}

var mongoClient = require('mongodb').MongoClient;
var dbURL = "mongodb://localhost:27017/mydb";

const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

function initDatabase(database) {
	database.createCollection("users", function(err, res) {
		if (err) throw err;
		console.log("Table created!");
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

	//if the client hasn't already been added
	var clientNew = true;
	for (var i = 0; i < clients.length; i++) {
		if (clients[i].address == rinfo.address) {
			clientNew = false;
			break;
		}
	}

	if (clientNew) {
		clients.push({address: rinfo.address, port: rinfo.port});
	}
/*
	var myobj = {
		ip: "Company Inc",
		address: "Highway 37"
	};
	database.collection("users").insertOne(myobj, function(err, res) {
	  if (err) throw err;
	  console.log("1 record inserted");
	});*/
});

socket.on('listening', () => {
	const address = socket.address();
	socket.setBroadcast(true);
	console.log(`server listening ${address.address}:${address.port}`);
	setInterval(sendNextPrice, 100);
});

socket.bind(5149);
// server listening 0.0.0.0:5149
