var	url = require('url');
var http = require('http');
var wisdmconfig=require('./wisdmconfig').wisdmconfig;	
var fs = require('fs');
var FileSystemServer=require('./filesystemserver').FileSystemServer;


//The FSServer will listen for connections from the file systems
var FSSERVER=new FileSystemServer();
FSSERVER.startListening(wisdmconfig.filesystemserver.listen_port);

//Add an approved file system so we can begin testing
console.log ('Adding approved file system');
FSSERVER.addApprovedFileSystem({client_id:'local',secret_id:'local_secret',owner:'magland'},function(tmp) {
	if (!tmp.success) {
		console.log ('Error adding file system: '+tmp.error);
	}
	else {
		console.log ('Added approved file system.');
	}
});

//Create the web server
http.createServer(function(REQ, RESP) {
	if (REQ.method == 'OPTIONS') {
		
		//allow cross-domain requests
		
		var headers = {};
		// IE8 does not allow domains to be specified, just the *
		// headers["Access-Control-Allow-Origin"] = req.headers.origin;
		headers["Access-Control-Allow-Origin"] = "*";
		headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
		headers["Access-Control-Allow-Credentials"] = false;
		headers["Access-Control-Max-Age"] = '86400'; // 24 hours
		headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
		RESP.writeHead(200, headers);
		RESP.end();
	}
	else if(REQ.method=='GET') {
		var url_parts = url.parse(REQ.url,true);
		if (url_parts.pathname=='/getFileChecksum') {
			get_file_checksum(url_parts.query,function(resp) {
				send_json_response(resp);
			});
		}
		else if (url_parts.pathname=='/setFileChecksum') {
			set_file_checksum(url_parts.query,function(resp) {
				send_json_response(resp);
			});
		}
		else {
			send_json_response({success:false,error:'Unrecognized path: '+url_parts.pathname});
			return;
		}
	}
	else {
		send_json_response({success:false,error:'Unrecognized method: '+REQ.method});
		return;
	}
	
	function send_json_response(obj) {
		RESP.writeHead(200, {"Access-Control-Allow-Origin":"*", "Content-Type":"application/json"});
		RESP.end(JSON.stringify(obj));
	}
	
	function get_file_checksum(params,callback) {
		var CC=FSSERVER.findFileSystemConnection(params.fsname);
		if (!CC) {
			callback({success:false,error:'Unable to find file system: '+params.fsname});
			return;
		}
		CC.processRequest({command:'getFileChecksum',path:params.path},callback);
	}
	function set_file_checksum(params,callback) {
		var CC=FSSERVER.findFileSystemConnection(params.fsname);
		if (!CC) {
			callback({success:false,error:'Unable to find file system: '+params.fsname});
			return;
		}
		CC.processRequest({command:'setFileChecksum',path:params.path,checksum:params.checksum},callback);
	}
}).listen(wisdmconfig.filesystemwebserver.listen_port);
