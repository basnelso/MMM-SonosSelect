/* global Module */

/* Magic Mirror 2
 * Module: MMM-SonosSelect
 *
 * By Brady Snelson
 * 
 * Using code from MMM-Modulebar by Erik Pettersson
 *
 * MIT Licensed.
 */

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

        this.coordinator = null;
        this.rooms = {};
        for (var num in this.config.buttons) {
            this.rooms[num] = {
                "playing": false
            }
        }
    },

    // Override dom generator.
    getDom: function() {
        var menu = document.createElement("span");
        menu.className = "icon-menu";
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

        var self = this;
        // Makes sure the width and height is at least the defined minimum.
		item.style.minWidth = self.config.minWidth;
        item.style.minHeight = self.config.minHeight;
		// When a button is clicked, the room either gets grouped/ungrouped depending on its status.
		item.addEventListener("click", function () {
            var url = self.config.serverIP;
            playing = self.rooms[num].playing
            if (playing) {
                if (self.coordinator != null) { // There is a room playing music
                    url += "/" + self.config.buttons[num].room + "/leave"
                } else {
                    url += "/" + self.config.buttons[num].room + "/pause"
                }
                self.rooms[num].playing = false;
            } else {
                if (self.coordinator != null) { // There is a room playing music
                    url += "/" + self.config.buttons[self.coordinator].room + "/add/" + self.config.buttons[num].room;
                } else { // No room is playing music
                    url += "/" + self.config.buttons[num].room + "/play"
                }
                self.rooms[num].playing = true;
            }
            console.log('button pressed: ' + num);
            console.log(self.rooms)
            console.log(url);
            self.sendSocketNotification("SONOS_BUTTON_CLICK", url);
            self.updateDom();
            self.getData();
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

        if (data.symbol) {
            var symbol = document.createElement("span");
            symbol.className = "room-symbol fa fa-" + data.symbol;
			// Sets the size on the symbol if specified.
            if (data.size) {
                symbol.className += " fa-" + data.size;
                symbol.className += data.size == 1 ? "g" : "x";
            }

            // Set the button as on or off
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
        return item;
    },

    getData: function() {
        var self = this;
        var url = self.config.serverIP + "/zones";
        this.sendSocketNotification('SONOS_GET_DATA', url);
    },

    processData: function(data) {
        for (var i in data) {
            var group = data[i];
            var members = group.members;
            for (var j in members) {
                var member = members[j]
                for (var num in this.config.buttons) { // Look through each room specified in config
                    var buttonRoomName = this.config.buttons[num].room;
                    if (buttonRoomName == member.roomName) { // Find the button that matches this member
                        if (member.playbackState == "PLAYING") {
                            console.log(this.config.buttons[num].room + ' is playing')
                            this.rooms[num].playing = true;
                        } else {
                            console.log(this.config.buttons[num].room + ' is stopped')
                            this.rooms[num].playing = false;
                        }
                    }
                }
            }
        }
        console.log('processed data: ')
        console.log(data)
        console.log(this.rooms)
    },

    setCoordinator: function() {
        var coordinatorFound = false;
        for (var num in this.rooms) {
            var room = this.rooms[num];
            if (room.playing) {
                this.coordinator = num;
                coordinatorFound = true;
            }
        }

        if (!coordinatorFound) {
            this.coordinator = null;
        }
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        if (notification === "SONOS_DATA") {
            self.processData(payload);
            self.setCoordinator();
        }
    },

    scheduleUpdates: function() {
        var nextLoad = this.config.updateInterval;
        var self = this;
        setInterval(function() {
            self.getData();
        }, nextLoad);
    }
});	


