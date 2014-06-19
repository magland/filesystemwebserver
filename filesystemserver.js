var WisdmSocket=require('../filesystemclient/wisdmsocket').WisdmSocket;
var wisdmconfig=require('./wisdmconfig').wisdmconfig;
var DATABASE=require('../filesystemclient/databasemanager').DATABASE;

function FileSystemServer() {
	var that=this;
	
	this.startListening=function(port) {m_server.listen(port); _initialize();};
	this.getConnectedClientIds=function() {return _getConnectedClientIds();};
	this.findFileSystemConnection=function(id) {return _findFileSystemConnection(id);};
	this.addApprovedFileSystem=function(request,callback) {return _addApprovedFileSystem(request,callback);};
	this.onSignal=function(handler) {m_signal_handlers.push(handler);};
	
	var m_approved_file_systems={};
	var m_file_system_connections={};
	var m_server=null;
	var m_signal_handlers=[];
	
	function _findFileSystemConnection(id) {
		if (id in m_file_system_connections) {
			if (m_file_system_connections[id].isConnected()) {
				return m_file_system_connections[id]; 
			}
			else {
				delete m_file_system_connections[id];
				return null;
			}
		}
		else return null;
	}
	function _getConnectedClientIds() {
		var ret=[];
		for (var id in m_file_system_connections) {
			if (m_file_system_connections[id].isConnected()) {
				ret.push(id);
			}
		}
		ret.sort();
		return ret;
	}
	
	m_server=require('net').createServer(function(socket) {
		
		var wsocket=new WisdmSocket(socket);
		
		var file_system_connection=null;
		var client_id=null;
		
		var initialized=false;
		wsocket.onMessage(function (msg) {
			if (!initialized) {
				if (msg.command=='connect_as_file_system') {
					console.log ('connect_as_file_system',msg.client_id,msg.owner);
					if (is_valid_connection_request(msg)) {
						if (msg.client_id in m_file_system_connections) {
							if (!m_file_system_connections[msg.client_id].isConnected()) {
								console.log ('REMOVING FILE SYSTEM CONNECTION **: '+msg.client_id);
								delete m_file_system_connections[msg.client_id];
							}
						}
						if (!(msg.client_id in m_file_system_connections)) {
							client_id=msg.client_id;
							file_system_connection=new FileSystemConnection();
							file_system_connection.setWisdmSocket(wsocket);
							file_system_connection.setClientId(client_id);
							file_system_connection.setOwner(msg.owner);
							file_system_connection.setFileSystemAccess(msg.access||{error:'Undefined access'});
							file_system_connection.onSignal(function(signal) {
								var ppp={client_id:client_id};
								m_signal_handlers.forEach(function(handler) {
									handler(ppp,signal);
								});
							});
							
							m_file_system_connections[client_id]=file_system_connection;
							file_system_connection.initialize();
							initialized=true;
							
							console.log ('FILE SYSTEM CONNECTED: '+msg.client_id);
							/*
							setTimeout(function() {
								test_get_file_bytes();
							},1000);
							*/
							
						}
						else {
							console.error('A file_system with this id is already connected: '+msg.client_id);
							close_socket();
						}
					}
					else {
						console.error('Rejecting invalid connection request: '+msg.client_id+' '+msg.owner);
						close_socket();
					}
				}
				else {
					console.error('Expected command=connect_as_file_system');
					close_socket();
				}
			}
		});
		wsocket.onClose(function() {
			do_cleanup();
		});
		
		function close_socket() {
			if (!wsocket) return;
			console.error('closing socket: '+wsocket.remoteAddress()+":"+wsocket.remotePort());
			wsocket.disconnect();
			wsocket=null;
			if ((client_id)&&(client_id in m_file_system_connections)) {
				m_file_system_connections[client_id]=null;
			}
		}
	});
	
	function _initialize() {
		var DB=DATABASE('filesystemserver');
		DB.setCollection('approved_file_systems');
		DB.find({},{owner:1,client_id:1,secret_id:1},function(err,docs) {
			if (err) {
				console.error('Problem finding approved file_systems: '+err);
				return;
			}
			docs.forEach(function(doc) {
				m_approved_file_systems[doc.client_id]=doc;
			});
		});
	}
	
	function _addApprovedFileSystem(request,callback) {
		
		console.log('&&&&&&&&&&&&&& addApprovedFileSystem',JSON.stringify(request));
		
		var client_id=request.client_id;
		var user_id=(request.auth_info||{}).user_id;
		var owner=request.owner||'';
		var secret_id=request.secret_id||'';
		
		console.log('test 1');
		
		if ((!client_id)||(!secret_id)||(!owner)) {
			callback({success:false,error:'Missing required information.'});
			return;
		}
		if (client_id.length>100) {
			callback({success:false,error:'client_id is too long!'});
			return;
		}
		if (secret_id.length>100) {
			callback({success:false,error:'secret_id is too long!'});
			return;
		}
		
		console.log('test 2');
		
		if ((user_id!=owner)&&(client_id!='local')) { //remove the second condition
			callback({success:false,error:'user_id does not match owner'});
			return;
		}
		
		var DB=DATABASE('filesystemserver');
		DB.setCollection('approved_file_systems');
			
		console.log('test 3');
		
		DB.find({_id:client_id},{owner:1},function(err,docs) {
			console.log('test 4');
			if (err) {
				console.log('test 4.1');
				callback({success:false,error:'Problem in find: '+err});
				return;
			}
			if (docs.length>0) {
				if (docs[0].owner!=owner) {
					console.log('test 4.2');
					callback({success:false,error:'client_id exists with different owner'});
					return;
				}
			}
			var doc={_id:client_id,client_id:client_id,owner:owner,secret_id:secret_id};
			console.log('test saving');
			DB.save(doc,function(err) {
				console.log('test 5');
				if (err) {
					callback({success:false,error:'Error saving record to database: '+err});
					return;
				}
				m_approved_file_systems[client_id]=doc;
				callback({success:true});
			});
		});
	}
	
	/*
	function open_database(params,callback) {
		var db=new mongo.Db('filesystemserver', new mongo.Server('localhost',params.port||27017, {}), {safe:true});
		db.open(function(err,db) {
			if (err) {
				if (callback) callback(err,null);
			}
			else {
				if (callback) callback('',db);
			}
		});
	}
	*/
	
	function is_valid_connection_request(msg) {
		var client_id=msg.client_id;
		if (!(client_id in m_approved_file_systems)) return false;
		var tmp=m_approved_file_systems[client_id];
		if (tmp.client_id!=msg.client_id) return false;
		if (tmp.owner!=msg.owner) return false;
		if (tmp.secret_id!=msg.secret_id) return false;
		return true;
	}
	
	function do_cleanup() {
		for (var id in m_file_system_connections) {
			if (!m_file_system_connections[id].isConnected()) {
				console.log ('REMOVING FILE SYSTEM CONNECTION: '+id);
				delete m_file_system_connections[id];
			}
		}
	}
	
	function periodic_cleanup() {
		do_cleanup();
		
		setTimeout(periodic_cleanup,10000);
	}
	periodic_cleanup();
}

function FileSystemConnection() {
	var that=this;
	
	this.setWisdmSocket=function(wsocket) {m_wsocket=wsocket;};
	this.initialize=function() {_initialize();};
	this.processRequest=function(request,callback) {_processRequest(request,callback);};
	this.isConnected=function() {return _isConnected();};
	this.setClientId=function(id) {m_client_id=id;};
	this.setOwner=function(owner) {m_owner=owner;};
	this.setFileSystemAccess=function(access) {m_file_system_access=access;};
	this.clientId=function() {return m_client_id;};
	this.owner=function() {return m_owner;};
	this.fileSystemAccess=function() {return m_file_system_access;};
	this.onSignal=function(handler) {m_signal_handlers.push(handler);};
	
	var m_wsocket=null;
	var m_response_waiters={};
	var m_client_id='';
	var m_owner='';
	var m_file_system_access={};
	var m_signal_handlers=[];
	
	function _initialize() {
		if (!m_wsocket) return;
		m_wsocket.sendMessage({command:'connection_accepted'});
		m_wsocket.onMessage(function(msg) {
			process_message_from_file_system(msg);
		});
	}
	
	function checkRequestAllowed(request,callback) {
		//finish
		var valid_file_system_commands=[
			'checkFileSystemStatus',
			'getFileChecksum','getFileText','setFileText','getFileData','setFileData','getFileBytes',
			'readDir','removeFile',
			'updateFileSystemSource',
			'getFileSystemAccess','setFileSystemAccess'
		];
		
		var command=request.command||'';
		var auth_info=request.auth_info||{};
		if (!auth_info.permissions) auth_info.permissions={};
		if (valid_file_system_commands.indexOf(command)<0) {
			callback({allowed:false,reason:'unknown',message:'Unknown command ***: '+command});
			return;
		}
		
		if (command=='updateFileSystemSource') {
			if ((auth_info||{}).user_id!='magland') {
				callback({allowed:false,reason:'unauthorized',message:'You are not authorized to update file system source.'});
				return;
			}
		}
		callback({allowed:true});
		
	}
	
	function _processRequest(request,callback) {
		checkRequestAllowed(request,function(tmp00) {
			if (tmp00.allowed) {
				var command=request.command||'';
				if (command=='checkFileSystemStatus') {
					callback({success:true,status:'found'});
				}
				else {
					send_request_to_file_system(request,callback);
				}
			}
			else {
				if (tmp00.reason=='unauthorized') {
					callback({success:false,error:tmp00.message,authorization_error:true});
				}
				else {
					callback({success:false,error:tmp00.message});
				}
			}
		});
	}
	function _isConnected() {
		if (!m_wsocket) return;
		return m_wsocket.isConnected();
	}
	function make_random_id(numchars) {
		if (!numchars) numchars=10;
		var text = "";
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		for( var i=0; i < numchars; i++ ) text += possible.charAt(Math.floor(Math.random() * possible.length));	
		return text;
	} 
	function send_request_to_file_system(request,callback) {
		request.server_request_id=make_random_id(8);
		if (m_wsocket) {
			m_wsocket.sendMessage(request);
			m_response_waiters[request.server_request_id]=function(tmpCC) {
				if (tmpCC.success) {
					if ((request.command||'')=='setFileSystemAccess') {
						m_file_system_access=request.access||{error:'Unexpected problem 343'};
					}
				}
				callback(tmpCC);
			};
		}
		else {
			console.error('Could not send request to file system... m_wsocket is null');
		}
	}
	
	function process_message_from_file_system(msg,callback) {
		if (msg.server_request_id) {
			if (msg.server_request_id in m_response_waiters) {
				m_response_waiters[msg.server_request_id](msg);
				delete m_response_waiters[msg.server_request_id];
			}
		}
		else if ((msg.command||'')=='signal') {
			m_signal_handlers.forEach(function(handler) {
				handler(msg);
			});
		}
	}
}

exports.FileSystemServer=FileSystemServer;