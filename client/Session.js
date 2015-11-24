package("kb", function(exports) {
	"use strict";

	depends("util/Notifier.js");

	exports.Session = Session;

	function Session(context, logoutProvider) {
		this.notifier_ = new kb.util.Notifier();
		this.notifier_.mixto(this);

		context = context || {};
		this.user = context.user || {
			id: "",
			email: "",
			name: "",
			company: "",
			admin: false
		};

		var params = context.params || {};
		this.home = params.home || "Community=Welcome";
		this.branch = params.branch || "10.2.600";
		this.token = context.token || null;

		this.logoutProvider_ = logoutProvider;
	}
	Session.fetch = function(opts) {
		(new Session()).fetch(opts);
	};

	Session.prototype = {
		logout: function() {
			this.fetch({
				url: "/system/auth/logout"
			});

			this.logoutProvider_();
			this.notifier_.emit({
				type: "session-finished",
				error: ""
			});
		},
		fetch: function(opts) {
			if (typeof opts.url === "undefined") {
				throw new Error("No url defined.");
			}

			opts.method = opts.method || "POST";
			opts.ondone = opts.ondone || function() {};
			opts.onerror = opts.onerror || function() {};

			opts.headers = opts.headers || {};
			if (this.token) {
				opts.headers["X-Auth-Token"] = opts.headers["X-Auth-Token"] || this.token;
			}

			if (["GET", "PUT", "POST", "DELETE"].indexOf(opts.method) < 0) {
				throw new Error("Invalid method: " + opts.method);
			}

			var self = this;

			var xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (xhr.readyState !== 4) {
					return;
				}

				var response = {
					get json() {
						return JSON.parse(xhr.responseText);
					},
					url: xhr.responseURL || opts.url,
					status: xhr.status,
					ok: xhr.status === 200,
					statusText: xhr.statusText,
					text: xhr.responseText,
					xhr: xhr
				};

				opts.ondone(response);

				if (response.status === 401) {
					self.notifier_.emit({
						type: "session-finished",
						error: response.text
					});
					return;
				}
			};

			xhr.onerror = function(err) {
				opts.onerror(err);
			};

			xhr.open(opts.method, opts.url);

			for (var name in opts.headers) {
				if (!opts.headers.hasOwnProperty(name)) {
					continue;
				}
				xhr.setRequestHeader(name, opts.headers[name]);
			}

			if ((typeof opts.body === "undefined") || (opts.body === null)) {
				xhr.send();
			} else {
				xhr.send(opts.body);
			}

			return xhr;
		}
	};
});