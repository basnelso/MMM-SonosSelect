/* global Module */

/* Magic Mirror 2
 * Module: MMM-Modulebar
 *
 * By Erik Pettersson
 * Based on the TouchNavigation Module by Brian Janssen
 *
 * MIT Licensed.
 */

//const request = require('request');

Module.register("MMM-SonosSelect",{
	
	requiresVersion: "2.1.0",
	
    defaults: {
        // Determines if the border around the buttons should be shown.
        showBorder: true,
        minWidth: "50px",
        minHeight: "50px",
        // The direction of the bar. Options: row, column, row-reverse or column-reverse
        direction: "row",
		serverIP: "http://localhost:5005",
        updateInterval: 10 * 1000, // 10 seconds
		buttons: {
            "1": {
				room: "Living Room",
                symbol: "couch"
            },
			"2": {
				room: "Kitchen",
                symbol: "utensils"
            },
			"3": {
				room: "Bathroom",
                symbol: "toilet"
            },
		}
    },

    // Define required styles.
	getStyles: function(){
		return ["font-awesome.css", "MMM-SonosSelect.css"];
	},

    start: function() {
        Log.info('Starting module: ' + this.name + ', version ' + this.config.version);

        this.scheduleUpdates();
        this.rooms = {};
        for (var num in this.config.buttons) {
            //var room_name = this.config.buttons[num].room
            this.rooms[num] = {
                "playing": true
            }
        }
    },

    // Override dom generator.
    getDom: function() {
        var menu = document.createElement("span");
        menu.className = "modulebar-menu";
        menu.id = this.identifier + "_menu";
        menu.style.flexDirection = this.config.direction;
		// Sends each button to the "createButton" function be created.
		for (var num in this.config.buttons) {
			menu.appendChild(this.createButton(this, num, this.config.buttons[num]));
        }

        return menu;
    },

	// Creates the buttons.
    createButton: function (self, num, data) {
		// Creates the span element to contain all the buttons.
		var item = document.createElement("span");
        // Builds a unique identity / button.
		item.id = self.identifier + "_button_" + num;
        // Sets a class to all buttons.
		item.className = "room-button";
        


        // Makes sure the width and height is at least the defined minimum.
		item.style.minWidth = self.config.minWidth;
        item.style.minHeight = self.config.minHeight;
		// When a button is clicked, the room either gets grouped/ungrouped depending on its status.
		item.addEventListener("click", function () {
            var self = this;
            console.log('button pressed: ' + num);
            var url = self.config.serverIP;
            //self.sendSocketNotification("GET_SONOS", url);
            playing = self.rooms[num].playing
            if (playing) {
                url += "/" + self.config.buttons[num].room + "/leave"
                self.rooms[num].playing = false;
            } else {
                self.rooms[num].playing = true;
            }
    
            self.updateDom();
		});
		// Fixes the aligning.
        item.style.flexDirection = {
            "right"  : "row-reverse",
            "left"   : "row",
            "top"    : "column",
            "bottom" : "column-reverse"
        }["left"];
		// Sets the border around the symbol/picture/text to black.
        if (!self.config.showBorder) {
            item.style.borderColor = "black";
        }
		// Adds the Font-Awesome symbol if specified.
        if (data.symbol) {
            var symbol = document.createElement("span");
            symbol.className = "modulebar-picture fa fa-" + data.symbol;
			// Sets the size on the symbol if specified.
            if (data.size) {
                symbol.className += " fa-" + data.size;
                symbol.className += data.size == 1 ? "g" : "x";
            }

                    // Test if button should be shaded or not
            if (this.rooms[num].playing) {
                item.className += " room-button-on";
                symbol.className += " room-symbol-on";
            } else {
                item.className += " room-button-off";
                symbol.className += " room-symbol-off";
            }

			// Adds the symbol to the item.
            item.appendChild(symbol);
        }
		// All done. :)
        return item;
    },

    getData: function() {
        var self = this;
        var url = self.config.serverIP + "/zones";
        this.sendSocketNotification('SONOS_GET_DATA', url);
    },

    processData: function(data) {
        console.log("processing data from sonos");
        console.log(data);
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        if (notification === "SONOS_DATA") {
            self.processData(payload);
        } else if (notification === "SONOS_DATA_ERR") {
        }
    },

    scheduleUpdates: function() {
        var nextLoad = this.config.updateInterval;
        console.log('scheduleupdates called')
        var self = this;
        setInterval(function() {
            console.log('called setInterval')
            self.getData();
        }, nextLoad);
    }
});	


