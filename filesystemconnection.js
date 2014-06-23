exports.FileSystemConnection=FileSystemConnection;

function FileSystemConnection() {
	var that=this;
	
	this.setWisdmSocket=function(wsocket) {m_wsocket=wsocket;};
	this.initialize=function() {_initialize();};
	this.processRequest=function(request,callback) {_processRequest(request,callback);};
	this.isConnected=function() {return _isConnected();};
	
	var m_wsocket=null;
	var m_response_waiters={};
	
	function _initialize() {
		if (!m_wsocket) return;
		m_wsocket.sendMessage({command:'connection_accepted'});
		m_wsocket.onMessage(function(msg) {
			process_message_from_file_system(msg);
		});
	}
	
	function checkRequestAllowed(request,callback) {
		var valid_file_system_commands=[
			'getFileChecksum','setFileChecksum'
		];
		
		var command=request.command||'';
		if (valid_file_system_commands.indexOf(command)<0) {
			callback({success:true,allowed:false,reason:'unknown',message:'Unknown command +++: '+command});
			return;
		}
	
		callback({success:true,allowed:true});
	}
	
	function _processRequest(request,callback) {
		checkRequestAllowed(request,function(tmp00) {
			if (tmp00.allowed) {
				var command=request.command||'';
				send_request_to_file_system(request,callback);
			}
			else {
				callback({success:false,error:tmp00.message});
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
