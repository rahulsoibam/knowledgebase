// import "/kb/Slug.js"

Convert = {};
(function(Convert){
	"use strict";

	// There are several possible links
	// "//kb.example.com/example" - full URL
	// "/kb:example" - rooted local URL
	// "kb:Example" - local URL
	Convert.LinkToReference = function(link){
		link = link.trim();
		// External site:
		// "//kb.example.com/example"
		if((link[0] == "/") && (link[1] == "/") ) {
			return {
				link: link,
				url:  link,
				title: Convert.LinkToTitle(link)
			};
		}

		// remove prefix "/"
		if(link[0] == "/") {
			link = link.substr(1);
		}

		var i = link.lastIndexOf(":")
		var owner = i >= 0 ? link.substr(0,i): "";

		return {
			link: link,
			owner: owner,
			url: "/" + Slugify(link),
			title: Convert.LinkToTitle(link),
		};
	}

	Convert.ReferenceToLink = function(ref){
		return ref.url;
	};

	Convert.LinkToTitle = function(link){
		var i = Math.max(link.lastIndexOf("/"), link.lastIndexOf(":"));
		return link.substr(i + 1);
	};

	//TODO

	Convert.URLToReadable = function(url){
		return url;
	};

	Convert.URLToLink = function(url){
		return url;
	};

	Convert.URLToTitle = function(url){
		return url;
	};

	Convert.URLToLink = function(url){
		return url;
	};

	Convert.URLToLocation = function(url){
		var a = document.createElement("a");
		a.href = url;
		return {
			get hash(){ return a.hash; },
			set hash(v){ a.hash = v; },
			get search(){ return a.search; },
			set search(v){ a.search = v; },
			get pathname(){ return a.pathname; },
			set pathname(v){ a.pathname = v; },
			get port(){ return a.port; },
			set port(v){ a.port = v; },
			get hostname(){ return a.hostname; },
			set hostname(v){ a.hostname = v; },
			get host(){ return a.host; },
			set host(v){ a.host = v; },
			get password(){ return a.password; },
			set password(v){ a.password = v; },
			get username(){ return a.username; },
			set username(v){ a.username = v; },
			get protocol(){ return a.protocol; },
			set protocol(v){ a.protocol = v; },
			get origin(){ return a.origin; },
			set origin(v){ a.origin = v; },
			get url(){ return a.href; },
			set url(v){ a.href = v; }
		};
	};
})(Convert);
