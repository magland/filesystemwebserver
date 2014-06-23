//rename this file to wisdmconfig.js and modify

var wisdmconfig={};

wisdmconfig.filesystemwebserver={
	listen_port:8003,
	www_path:'/home/magland/wisdm/www/filesystemwebserver',
};

wisdmconfig.filesystemserver={
	listen_port:8004
};

exports.wisdmconfig=wisdmconfig;
