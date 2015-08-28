'use strict';

window.DocumentCookies = {
	getItem: function (sKey) {
		return;
		return decodeURIComponent(document.cookie.replace(new RegExp('(?:(?:^|.*;)\\s*' + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, '\\$&') + '\\s*\\=\\s*([^;]*).*$)|^.*$'), '$1')) || null;
	},
	setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
		return;
		if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
		var sExpires = '';
		if (vEnd) {
			switch (vEnd.constructor) {
				case Number:
					sExpires = vEnd === Infinity ? '; expires=Fri, 31 Dec 9999 23:59:59 GMT' : '; max-age=' + vEnd;
					break;
				case String:
					sExpires = '; expires=' + vEnd;
					break;
				case Date:
					sExpires = '; expires=' + vEnd.toUTCString();
					break;
			}
		}
		document.cookie = encodeURIComponent(sKey) + '=' + encodeURIComponent(sValue) + sExpires + (sDomain ? '; domain=' + sDomain : '') + (sPath ? '; path=' + sPath : '') + (bSecure ? '; secure' : '');
		return true;
	},
	removeItem: function (sKey, sPath, sDomain) {
		return;
		if (!sKey || !this.hasItem(sKey)) { return false; }
		document.cookie = encodeURIComponent(sKey) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT' + ( sDomain ? '; domain=' + sDomain : '') + ( sPath ? '; path=' + sPath : '');
		return true;
	},
	hasItem: function (sKey) {
		return (new RegExp('(?:^|;\\s*)' + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, '\\$&') + '\\s*\\=')).test(document.cookie);
	},
	keys: /* optional method: you can safely remove it! */ function () {
		var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, '').split(/\s*(?:\=[^;]*)?;\s*/);
		for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { aKeys[nIdx] = decodeURIComponent(aKeys[nIdx]); }
		return aKeys;
	}
};

window.GetDataAttribute = function GetDataAttribute(el, name){
	if(typeof el.dataset !== 'undefined'){
		return el.dataset[name];
	} else {
		return el.getAttribute('data-' + name);
	}
};

window.Hash = {
	save: function(){
		DocumentCookies.setItem('last-hash', document.location.hash, Infinity, '/');
	},
	restore: function(){
		var lastHash = DocumentCookies.getItem('hash');
		if(lastHash && (document.location.hash == '')){
			document.location.hash = lastHash;
		}
		DocumentCookies.removeItem('hash');
	}
};

window.GenerateID = function GenerateID(){
	return Math.random().toString(16).substr(2) +
		   Math.random().toString(16).substr(2);
};

window.TestCase = function TestCase(casename, runcase){
	var assert = {
		'true': function(ok, msg){ if(!ok){ throw new Error(msg); } },
		'fail': function(err){ throw new Error(err); },
		'equal': function(actual, expect, msg){
			if(actual !== expect) {
				var full = "\ngot " + actual + "\nexp " + expect;
				if(typeof msg !== 'undefined') {
					full = msg + full;
				}
				throw new Error(full);
			}
		}
	};

	try {
		runcase(assert);
	} catch(err) {
		console.error('assert ' + casename + ' failed:', err);
	}
};

window.getClassList = function(el){
	function split(s) { return s.length ? s.split(/\s+/g) : []; }

	if('classList' in el){
		return el.classList;
	}

	return {
		add: function(token){
			el.className += ' ' + token;
		},
		remove: function(token){
			var tokens = ' ' + el.className + ' ';
			tokens = tokens.replace(' ' + token + ' ', '');
			el.className = tokens.trim();
		},
		contains: function(token){
			return split(el.className).indexOf(token) >= 0;
		}
	};
};