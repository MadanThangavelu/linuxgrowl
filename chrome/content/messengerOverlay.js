/**************************************************************************/
/*  Copyright (c) 2012 HackingHabits (http://hackinghabits.com)           */
/*  All rights reserved.                                                  */
/*                                                                        */
/* This file is under the BSD License, refer to license.txt for details   */
/*                   	                                                  */
/* This Addon was motivated by the notification addon by brian dunnington */
/* which works for Mac OS and Windows.                                    */
/* https://addons.mozilla.org/en-US/thunderbird/user/4710843/             */
/**************************************************************************/

var linuxgrowl = function () {

	var growl = Components.classes['@growlforlinux.com/linuxgrowl;1'].getService().wrappedJSObject;
	var isThunderbird = true;
	var isPostbox = false;

	function init() {
		try {
			if (!growl.isInitialized) {
				growl.init();

				// add mail listener
				var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"].getService(Components.interfaces.nsIMsgFolderNotificationService);
				notificationService.addListener(newMailListener, 1);

				// override default notifications
				var oPrefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				oPrefs.setBoolPref("mail.biff.show_alert", false);
			}
			// register
			linuxgrowl.register();

			growl.addClickCallbackHandler(linuxgrowl.clickCallbackHandler);
		}
		catch (e) {
			Components.utils.reportError("linuxgrowl-thunderbird EXCEPTION: " + e.toString());
		}
	}

	function processQueue(queue) {
		try {
			while (queue.length > 0) {
				var notification = queue.pop();
				doNotification(notification.type, notification.title, notification.message, notification.callbackContext, notification.callbackType, notification.priority);
			}
		}
		catch (e) {
			Components.utils.reportError("linuxgrowl-thunderbird EXCEPTION: " + e.toString());
		}
	}

	function doNotification(type, title, message, callbackContext, callbackType, priority) {
		growl.notify(linuxgrowl.APPNAME, type, title, message, callbackContext, callbackType, priority);
	}

	var newMailListener = {
		itemAdded: function (item) {
			processNewItem(item);
		},
		msgAdded: function (item) {
			processNewItem(item);
		}
	}

	function processNewItem(item) {
		try {
			var msg = item.QueryInterface(Components.interfaces.nsIMsgDBHdr);
			if (msg.isRead) return;

			var uri = msg.folder.getUriForMsg(msg);

			if (linuxgrowl.isRss(msg.messageId)) {
				if (linuxgrowl.newrsstimer) window.clearTimeout(linuxgrowl.newrsstimer);

				var author = msg.folder.prettiestName;
				var regex = /^<([^>]*)>/;
				var match = regex.exec(author);
				if (match) author = match[1];

				linuxgrowl.rssqueue.push({ type: "newrss", title: author, message: msg.mime2DecodedSubject, callbackContext: uri, callbackType: "rss" });
				linuxgrowl.newrsstimer = window.setTimeout(linuxgrowl.processRssQueue, 1000);
			}
			else {
				if (linuxgrowl.newmailtimer) window.clearTimeout(linuxgrowl.newmailtimer);

				var author = msg.mime2DecodedAuthor;
				var regex = /<([^>]*)>|"*([^<>"]*)/;
				var match = regex.exec(author);
				if (match) author = match[1] || match[2];

				// Thunderbird priorities 0 & 1 are treated as 'normal'
				var priority = 0;
				if (msg.priority >= 2) {
					priority = msg.priority - 4;    // Thunderbird values are 2 thru 6, Growl values are -2 thru 2
				}

				linuxgrowl.mailqueue.push({ type: "newmail", title: author, message: msg.mime2DecodedSubject, priority: priority, callbackContext: uri, callbackType: "mail" });
				linuxgrowl.newmailtimer = window.setTimeout(linuxgrowl.processMailQueue, 1000);
			}
		}
		catch (e) {
			Components.utils.reportError("linuxgrowl-thunderbird EXCEPTION: " + e.toString());
		}
	}

	return {
		newmailtimer: null,
		newrsstimer: null,
		mailqueue: [],
		rssqueue: [],

		APPNAME: "Thunderbird",

		register: function () {
			try {
				var id = "linuxgrowl-thunderbird@brian.dunnington";

				var extensionPath = "";

				var extman = Components.classes["@mozilla.org/extensions/manager;1"];
				if (extman) {
					// get the extension path
					var extension = Components.classes["@mozilla.org/extensions/manager;1"]
									.getService(Components.interfaces.nsIExtensionManager)
									.getInstallLocation(id)
									.getItemLocation(id);
					var extensionPath = extension.path;

					// figure out which app we are talking about
					var appname = "Thunderbird";
					var icon = extensionPath + "\\chrome\\content\\thunderbird.png";

					var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
					switch (appInfo.ID) {
						case "postbox@postbox-inc.com":
							appname = "Postbox";
							var icon = extensionPath + "\\chrome\\content\\postbox.png";
							isThunderbird = false;
							isPostbox = true;
							break;
					};
					linuxgrowl.APPNAME = appname;

					var ntNewMail = { Name: 'newmail', DisplayName: 'New Mail Arrived' };
					var ntNewRSS = { Name: 'newrss', DisplayName: 'New RSS Item' };

					var notificationTypes = [ntNewMail, ntNewRSS];
					growl.register(linuxgrowl.APPNAME, icon, notificationTypes);
				} else {
					Components.utils.import("resource://gre/modules/AddonManager.jsm");
					AddonManager.getAddonByID("linuxgrowl-thunderbird@brian.dunnington", function (addon) {
						var fakeFile = addon.getResourceURI("fake.fak").asciiSpec;
						var extensionPath = fakeFile.replace("fake.fak", "");

						// figure out which app we are talking about
						var appname = "Thunderbird";
						var icon = extensionPath + "\\chrome\\content\\thunderbird.png";

						var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
						switch (appInfo.ID) {
							case "postbox@postbox-inc.com":
								appname = "Postbox";
								isThunderbird = false;
								isPostbox = true;
								var icon = extensionPath + "\\chrome\\content\\postbox.png";
								break;
						};
						linuxgrowl.APPNAME = appname;

						var ntNewMail = { Name: 'newmail', DisplayName: 'New Mail Arrived' };
						var ntNewRSS = { Name: 'newrss', DisplayName: 'New RSS Item' };

						var notificationTypes = [ntNewMail, ntNewRSS];
						growl.register(linuxgrowl.APPNAME, icon, notificationTypes);
					});
				}
			}
			catch (e) {
				Components.utils.reportError("linuxgrowl-thunderbird EXCEPTION: " + e.toString());
			}
		},

		processMailQueue: function () {
			try {
				var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				var groupAfter = prefs.getIntPref("linuxgrowl-thunderbird.maxmailnotifications");

				if (linuxgrowl.mailqueue.length > groupAfter) {
					doNotification("newmail", "New Mail", "You have " + linuxgrowl.mailqueue.length + " new emails.", linuxgrowl.mailqueue.length, "mailsummary");
					linuxgrowl.mailqueue = [];
				}
				else {
					processQueue(linuxgrowl.mailqueue);
				}
				linuxgrowl.newmailtimer = null;
			}
			catch (e) {
				Components.utils.reportError("linuxgrowl-thunderbird EXCEPTION: " + e.toString());
			}
		},

		processRssQueue: function () {
			try {
				var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("");
				var groupAfter = prefs.getIntPref("linuxgrowl-thunderbird.maxrssnotifications");

				if (linuxgrowl.rssqueue.length > groupAfter) {
					doNotification("newrss", "New Feed Items", "You have " + linuxgrowl.rssqueue.length + " new feed items.", linuxgrowl.rssqueue.length, "rsssummary");
					linuxgrowl.rssqueue = [];
				}
				else {
					processQueue(linuxgrowl.rssqueue);
				}
				linuxgrowl.newrsstimer = null;
			}
			catch (e) {
				Components.utils.reportError("linuxgrowl-thunderbird EXCEPTION: " + e.toString());
			}
		},

		isRss: function (id) {
			if (!id || id[0] != 'h' || id.length < 7) {
				return false;
			}
			else {
				return ((id.substring(0, 6) == "http:/") || (id.substring(0, 7) == "https:/"));
			}
		},

		clickCallbackHandler: function (data) {
			var messenger = Components.classes["@mozilla.org/messenger;1"].createInstance();
			messenger = messenger.QueryInterface(Components.interfaces.nsIMessenger);

			if (data.type == "mail" || data.type == "rss") {
				var messageUri = data.context;
				var msgHdr = messenger.msgHdrFromURI(messageUri);

				var newWindow;
				if (isPostbox)
					newWindow = window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank", "chrome,all,dialog=no", messageUri, msgHdr.folder.folderURL, GetDBView());
				else
					var newWindow = window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank", "chrome,all,dialog=no", msgHdr);
				newWindow.focus();
			}
			else {
				var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
				var recentWindow = windowMediator.getMostRecentWindow("mail:3pane");
				if (recentWindow) recentWindow.focus();
			}
		},

		onLoad: function () {
			this.strings = document.getElementById("linuxgrowl-strings");
			init();
		},

		sendTest: function () {
			doNotification("newmail", "Growl Test", "This is a test notification from " + linuxgrowl.APPNAME);
		}
	}
} ();
window.addEventListener("load", function(e) { linuxgrowl.onLoad(e); }, false);
dump("linuxgrowl-thunderbird is loading");
