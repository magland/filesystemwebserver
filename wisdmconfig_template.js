//rename this file to wisdmconfig.js and modify

var wisdmconfig={};

wisdmconfig.filesystemwebserver={
	listen_port:8004,
	www_path:'/home/magland/wisdm/www/filesystemwebserver',
	wisdmserver_url:'http://localhost:8000'
};

wisdmconfig.filesystemserver={
	listen_port:8083
};

exports.wisdmconfig=wisdmconfig;
