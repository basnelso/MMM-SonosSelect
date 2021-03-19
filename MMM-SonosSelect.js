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
        minWidth: "50px",
        minHeight: "50px",
        // The direction of the bar. Options: row, column, row-reverse or column-reverse
        direction: "row",
		serverIP: "http://localhost:5005",
        updateInterval: 20 * 1000, // 20 seconds
        updateExternally: true,
        broadcastStatus: false,
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
		},
    },

    // Define required styles.
	getStyles: function(){
		return ["font-awesome.css", "MMM-SonosSelect.css"];
	},

    start: function() {
        Log.info('Starting module: ' + this.name + ', version ' + this.config.version);

        this.getZoneData();
        if (!this.updateExternally) {
            this.scheduleUpdates();
        }

        this.sleepTime = 0;
        this.sliderSleep = 0;
        this.coordinator = null;
        this.masterVolume = 20;
        this.numRoomsPlaying = 0;


        this.rooms = {};
        for (var num in this.config.buttons) {
            this.rooms[num] = {
                "playing": false,
                "wasPlaying": false,
                "volume": 0,
                "groupVolume": 0
            }
        }
    },

    // Override dom generator.
    getDom: function() {
        var container = document.createElement("div");

        var menu = document.createElement("span");
        menu.className = "icon-menu";
        menu.id = this.identifier + "_menu";
        menu.style.flexDirection = this.config.direction;
		
        // Sends each button to the "createButton" function be created.
		for (var num in this.config.buttons) {
			menu.appendChild(this.createRoomButton(num, this.config.buttons[num]));
        }
        container.appendChild(menu);

        var control = document.createElement("span");
        
        control.className = "icon-menu";
        control.id = this.identifier + "_playpause";
        control.style.flexDirection = this.config.direction;

        control.appendChild(this.createRewindButton());
        control.appendChild(this.createPlayPauseButton());
        control.appendChild(this.createSkipButton());
        container.appendChild(control);
        
        container.appendChild(this.createVolumeSlider());

        return container;
    },

    createVolumeSlider: function() {
        volumeSlider = document.createElement("input");
        volumeSlider.type = "range";
        volumeSlider.id = "master-volume";
        volumeSlider.class = "slider";
        if (this.coordinator != null) {
            volumeSlider.value = this.rooms[this.coordinator].groupVolume;
        } else {
            volumeSlider.value = 0;
        }

        var self = this;
        volumeSlider.addEventListener("change", function(val) {
            self.sliderSleep = 5;
            volume = val.currentTarget.value;
            self.rooms[self.coordinator].groupVolume = volume;

            var url = self.config.serverIP + "/" + self.config.buttons[self.coordinator].room + "/groupVolume/" + volume;
            console.log(url);
            self.sendSocketNotification("SONOS_SLIDER", url)
        })

        return volumeSlider;
    },

    createPlayPauseButton: function() {
        var button = document.createElement("span");
		button.id = this.identifier + "_button_" + 11;
		button.className = "button control-button";
		button.style.minWidth = this.config.minWidth;
        button.style.minHeight = this.config.minHeight;

        var self = this;
        button.addEventListener("click", function () {
            var url = self.config.serverIP;
            if (self.numRoomsPlaying > 0) { // Music playing
                url += "/" + self.config.buttons[self.coordinator].room + "/pause";
                self.pauseSystem();
            } else if (self.coordinator != null) { // Music paused on coordinator
                url += "/" + self.config.buttons[self.coordinator].room + "/play";
                self.playSystem();
            }
            self.clickButton(url);
        });

        var symbol = document.createElement("span");

        if (this.numRoomsPlaying > 0) {
            symbol.className = "control-symbol fa fa-pause";
        } else {
            symbol.className = "control-symbol fa fa-play";
        }


        // Adds the symbol to the item.
        button.appendChild(symbol);

        return button;
    },

    pauseSystem: function() {
        this.numRoomsPlaying = 0;
        for (var num in this.rooms) {
            var room = this.rooms[num];
            if (room.playing) {
                room.wasPlaying = true;
                room.playing = false;
                this.numRoomsPlaying--;
            } else {
                room.wasPlaying = false;
            }
        }    
    },

    playSystem: function() {
        for (var num in this.rooms) {
            var room = this.rooms[num];
            if (room.wasPlaying) {
                room.wasPlaying = false;
                room.playing = true;
                this.numRoomsPlaying++;
            }
        }   
    },

    createRewindButton: function() {
        var button = document.createElement("span");
		button.id = this.identifier + "_button_" + 10;
		button.className = "button control-button";
		button.style.minWidth = this.config.minWidth;
        button.style.minHeight = this.config.minHeight;
        
        var self = this;
        button.addEventListener("click", function () {
            if (self.numRoomsPlaying > 0) { // Music playing
                var url = self.config.serverIP;
                url += "/" + self.config.buttons[self.coordinator].room + "/previous";
                self.clickButton(url);
            }
        });

        var symbol = document.createElement("span");
        symbol.className = "control-symbol fa fa-backward";
        
        button.appendChild(symbol);
        return button;
    },

    createSkipButton: function() {
        var button = document.createElement("span");
		button.id = this.identifier + "_button_" + 12;
		button.className = "button control-button";
		button.style.minWidth = this.config.minWidth;
        button.style.minHeight = this.config.minHeight;

        var self = this;
        button.addEventListener("click", function () {
            if (self.numRoomsPlaying > 0) { // Music playing
                var url = self.config.serverIP;
                url += "/" + self.config.buttons[self.coordinator].room + "/next";
                self.clickButton(url);
            }
        });

        var symbol = document.createElement("span");
        symbol.className = "control-symbol fa fa-forward";
        
        button.appendChild(symbol);
        return button;
    },

	// Creates the buttons.
    createRoomButton: function (num, data) {
		var button = document.createElement("span");
		button.id = this.identifier + "_button_" + num;
		button.className = "button";

        // Makes sure the width and height is at least the defined minimum.
		button.style.minWidth = this.config.minWidth;
        button.style.minHeight = this.config.minHeight;

		// When a button is clicked, the room either gets grouped/ungrouped depending on its status.
        var self = this;
        button.addEventListener("click", function () {
            var url = self.config.serverIP;
            room_playing = self.rooms[num].playing
            if (room_playing) {
                if (self.numRoomsPlaying > 1) { // More than 1 room playing music
                    url += "/" + self.config.buttons[num].room + "/leave"
                    self.rooms[num].playing = false;
                    self.numRoomsPlaying--;
                } else {
                    url += "/" + self.config.buttons[num].room + "/pause"
                    self.pauseSystem();
                }
            } else {
                if (self.numRoomsPlaying > 0) { // There is a room playing music
                    url += "/" + self.config.buttons[self.coordinator].room + "/add/" + self.config.buttons[num].room;
                    self.rooms[num].playing = true;
                    self.numRoomsPlaying++;
                } else { // No room is playing music
                    url += "/" + self.config.buttons[num].room + "/play"
                    self.playSystem();
                }
            }
            self.clickButton(url);
		});

        // Symbol dynamic css
        var symbol = document.createElement("span");
        symbol.className = "room-symbol fa fa-" + data.symbol;

        // Set the button as on or off
        if (this.rooms[num].playing) {
            button.className += " room-button-on";
            symbol.className += " room-symbol-on";
        } else {
            button.className += " room-button-off";
            symbol.className += " room-symbol-off";
        }

	    // Adds the symbol to the item.
        button.appendChild(symbol);
        return button;
    },

    updateSystem: function() {
        // Determine if system is playing and determine coordinator
        this.numRoomsPlaying = 0;
        for (var num in this.rooms) {
            var room = this.rooms[num];
            if (room.playing) {
                this.coordinator = num;
                this.numRoomsPlaying++;
            }
        }
        this.updateDom();
    },

    // Determine the rooms that are currently playing music
    processZoneData: function(data) {
        for (var i in data) {
            var group = data[i];
            var members = group.members;
            for (var j in members) {
                var member = members[j]
                for (var num in this.config.buttons) { // Look through each room specified in config
                    var buttonRoomName = this.config.buttons[num].room;
                    if (buttonRoomName == member.roomName) { // Find the button that matches this member
                        if (member.state.playbackState == "PLAYING") {
                            this.rooms[num].playing = true;
                            
                            if (this.sliderSleep == 0) {
                                this.rooms[num].groupVolume = member.groupState.volume;
                                this.rooms[num].volume = member.state.volume;
                            } else {
                                this.sliderSleep--;
                            }

                        } else {
                            this.rooms[num].playing = false;
                        }
                    }
                }
            }
        }
        this.updateSystem();
    },

    clickButton: function(url) {
        this.sleeping = 5;
        this.sendSocketNotification("SONOS_BUTTON_CLICK", url);
        this.updateSystem();
    },

    socketNotificationReceived: function(notification, payload) {
        if (!this.config.updateExternally && notification == "SONOS_ZONE_DATA") {
            if (!sleeping) {
                this.processZoneData(payload);
                if (this.config.broadcastStatus) {
                    this.sendNotification("SONOS_ZONE_DATA", payload);
                }
            } else {
                this.sleeping--;
            }
        }
    },

    notificationReceived: function(notification, payload) {
        if (this.config.updateExternally && notification == "SONOS_ZONE_DATA") {
            if (!this.sleeping) {
                this.processZoneData(payload);
            } else {
                this.sleeping--;
            }
        }
    },

    getZoneData: function() {
        var self = this;
        var url = self.config.serverIP + "/zones";
        this.sendSocketNotification('SONOS_GET_DATA', url);
    },

    scheduleUpdates: function() {
        var self = this;
        setInterval(function() {
            self.getZoneData();
        }, this.config.updateInterval);
    },

    suspend: function() {
        // this method is triggered when a module is hidden using this.hide()

        this.sleeping = true;

    },

    resume: function() {

    }
});	


