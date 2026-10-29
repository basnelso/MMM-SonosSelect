/* global Module */

/* Magic Mirror 2
 * Module: MMM-SonosSelect
 *
 * By Brady Snelson
 *
 * A permanent Sonos panel: transport controls, group volume and a tile per room.
 * Talks to the speakers directly from the node helper (no node-sonos-http-api server needed).
 *
 * MIT Licensed.
 */

Module.register("MMM-SonosSelect", {

    requiresVersion: "2.1.0",

    defaults: {
        updateInterval: 3 * 1000,
        columns: 4,
        // Volume changes are sent at most this often while dragging; the speakers queue up anything faster.
        volumeThrottle: 250,
        // Treat rooms playing TV audio (HDMI/optical) as idle so the panel only controls music.
        ignoreTvAudio: true,
        buttons: {
            "1": {
                room: "Living Room",
                symbol: "couch"
            },
            "2": {
                room: "Kitchen",
                symbol: "utensils"
            }
        },
    },

    getStyles: function() {
        return ["font-awesome.css", "MMM-SonosSelect.css"];
    },

    start: function() {
        Log.info('Starting module: ' + this.name);
        this.groups = [];
        this.roomVolumes = {};
        // Volume limits broadcast by MMM-SonosEQ, which also enforces them: { rooms: { name: 0-100 }, group: 0-100 }.
        this.volumeLimits = { rooms: {}, group: null };
        this.activeCoordinatorName = this.loadRememberedRoom();
        this.errorMessage = null;
        this.sendSocketNotification('SONOS_START', { updateInterval: this.config.updateInterval });
    },

    roomNames: function() {
        return Object.values(this.config.buttons).map(button => button.room);
    },

    groupOfRoom: function(roomName) {
        return this.groups.find(group => group.memberNames.includes(roomName)) || null;
    },

    isTvGroup: function(group) {
        return this.config.ignoreTvAudio && group.source === 'tv';
    },

    // With ignoreTvAudio, a room playing the TV counts as idle, so it never lights up or becomes the
    // group the panel controls.
    isPlaying: function(group) {
        return !!group && !this.isTvGroup(group) && (group.state === 'playing' || group.state === 'transitioning');
    },

    // The panel follows one group at a time: the one last picked on the mirror if it is still playing,
    // otherwise a playing group, preferring Spotify over other music over TV audio.
    // With ignoreTvAudio, groups on TV audio are left out entirely, so with only the TV on the panel shows as paused.
    activeGroup: function() {
        const configuredGroups = this.groups.filter(group => !this.isTvGroup(group) &&
            group.memberNames.some(name => this.roomNames().includes(name)));
        const remembered = configuredGroups.find(group => group.memberNames.includes(this.activeCoordinatorName));
        if (remembered && this.isPlaying(remembered)) {
            return remembered;
        }
        const playingGroups = configuredGroups.filter(group => this.isPlaying(group));
        const sourceOrder = ['spotify', 'music', 'tv'];
        const playingGroup = sourceOrder.map(source => playingGroups.find(group => group.source === source))
            .find(Boolean) || playingGroups[0];
        if (playingGroup) {
            // Remember it even when the music was started from another app, so that after a pause
            // Play resumes the same rooms instead of the panel losing track of them.
            this.rememberRoom(playingGroup.coordinatorName);
            return playingGroup;
        }
        return remembered || null;
    },

    // Kept in localStorage so a page refresh doesn't forget which rooms to resume.
    loadRememberedRoom: function() {
        try {
            return localStorage.getItem('MMM-SonosSelect.activeRoom');
        } catch (error) {
            return null;
        }
    },

    rememberRoom: function(roomName) {
        if (roomName === this.activeCoordinatorName) {
            return;
        }
        this.activeCoordinatorName = roomName;
        try {
            localStorage.setItem('MMM-SonosSelect.activeRoom', roomName);
        } catch (error) {
            // Storage unavailable; the room is still remembered until the page reloads.
        }
    },

    getDom: function() {
        const panel = document.createElement("div");
        panel.className = "sonos-panel";

        const group = this.activeGroup();
        if (this.errorMessage && this.groups.length === 0) {
            panel.appendChild(this.createStatus());
        }
        // Rooms first and room sliders last: the sliders come and go as rooms are grouped, and anything
        // below them would jump while a finger is on it.
        panel.appendChild(this.createRoomGrid(group));
        panel.appendChild(this.createTransport(group));
        panel.appendChild(this.createVolumeSlider(group));
        if (group && this.isPlaying(group) && group.memberNames.length > 1) {
            panel.appendChild(this.createRoomVolumes(group));
        }
        return panel;
    },

    // What is playing is already shown by MMM-OnSpotify, so this only appears when the speakers can't be reached.
    createStatus: function() {
        const status = document.createElement("div");
        status.className = "sonos-status";
        status.textContent = "Sonos unavailable, looking for speakers…";
        return status;
    },

    createTransport: function(group) {
        const transport = document.createElement("div");
        transport.className = "sonos-transport";
        const playing = this.isPlaying(group);

        transport.appendChild(this.createTransportButton("fa-backward-step", group && playing, () =>
            this.sendCommand({ action: 'previous', room: group.coordinatorName })));
        transport.appendChild(this.createTransportButton(playing ? "fa-pause" : "fa-play", group, () => {
            group.state = playing ? 'paused' : 'playing';
            this.sendCommand({ action: playing ? 'pause' : 'play', room: group.coordinatorName });
        }, "sonos-play-button"));
        transport.appendChild(this.createTransportButton("fa-forward-step", group && playing, () =>
            this.sendCommand({ action: 'next', room: group.coordinatorName })));
        return transport;
    },

    createTransportButton: function(icon, enabled, onClick, extraClass) {
        const button = document.createElement("div");
        button.className = "sonos-transport-button " + (extraClass || "") + (enabled ? "" : " sonos-disabled");
        const symbol = document.createElement("i");
        symbol.className = "fa-solid " + icon;
        button.appendChild(symbol);
        if (enabled) {
            button.addEventListener("click", onClick);
        }
        return button;
    },

    createVolumeSlider: function(group) {
        const wrapper = document.createElement("div");
        wrapper.className = "sonos-volume";

        const quietIcon = document.createElement("i");
        quietIcon.className = "fa-solid fa-volume-low";
        const loudIcon = document.createElement("i");
        loudIcon.className = "fa-solid fa-volume-high";

        const volume = group && group.groupVolume !== null ? group.groupVolume : 0;
        wrapper.appendChild(quietIcon);
        const groupLimit = this.groupVolumeLimit(group);
        wrapper.appendChild(this.createSlider(volume, !!group, newVolume => {
            group.groupVolume = newVolume;
            this.sendCommand({ action: 'groupVolume', room: group.coordinatorName, volume: newVolume }, false);
        }, groupLimit));
        wrapper.appendChild(loudIcon);
        return wrapper;
    },

    // One slider per room, shown only while several rooms play together, so each room can be balanced
    // against the others; the main slider above moves them all at once.
    createRoomVolumes: function(group) {
        const roomVolumes = document.createElement("div");
        roomVolumes.className = "sonos-room-volumes";

        for (const button of Object.values(this.config.buttons)) {
            if (!group.memberNames.includes(button.room) || this.roomVolumes[button.room] === null) {
                continue;
            }
            const row = document.createElement("div");
            row.className = "sonos-room-volume";

            const symbol = document.createElement("i");
            symbol.className = "fa fa-" + button.symbol;
            row.appendChild(symbol);
            row.appendChild(this.createSlider(this.roomVolumes[button.room] || 0, true, newVolume => {
                this.roomVolumes[button.room] = newVolume;
                this.sendCommand({ action: 'roomVolume', room: button.room, volume: newVolume }, false);
            }, this.volumeLimit(button.room)));
            roomVolumes.appendChild(row);
        }
        return roomVolumes;
    },

    volumeLimit: function(roomName) {
        const limit = this.volumeLimits.rooms[roomName];
        return typeof limit === 'number' ? limit : 100;
    },

    // Group volume is roughly the members' average, so it can't usefully go past the loudest member's limit;
    // rooms playing together are also held to the group limit.
    groupVolumeLimit: function(group) {
        if (!group) {
            return 100;
        }
        const loudestRoomLimit = Math.max(...group.memberNames.map(name => this.volumeLimit(name)));
        const groupLimit = group.memberNames.length > 1 && typeof this.volumeLimits.group === 'number' ? this.volumeLimits.group : 100;
        return Math.min(loudestRoomLimit, groupLimit);
    },

    // The slider stops at the limit, and a red line across the track shows where it is.
    createSlider: function(volume, enabled, onVolume, limit = 100) {
        const wrap = document.createElement("div");
        wrap.className = "sonos-slider-wrap";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "sonos-volume-slider";
        slider.min = 0;
        slider.max = 100;
        slider.value = volume;
        slider.disabled = !enabled;

        var self = this;
        var lastSent = 0;
        const sendVolume = function (isFinal) {
            if (Number(slider.value) > limit) {
                slider.value = limit;
            }
            const now = Date.now();
            if (isFinal || now - lastSent > self.config.volumeThrottle) {
                lastSent = now;
                onVolume(Number(slider.value));
            }
        };
        slider.addEventListener('input', () => sendVolume(false));
        slider.addEventListener('change', () => sendVolume(true));

        // Electron treats a finger drag on a range input as a scroll, so follow the finger ourselves
        // (same workaround as the Photobooth colour slider).
        const setFromTouch = function (touch, isFinal) {
            const rect = slider.getBoundingClientRect();
            const fraction = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
            slider.value = Math.round(fraction * 100);
            sendVolume(isFinal);
        };
        ['touchstart', 'touchmove', 'touchend'].forEach(type => {
            slider.addEventListener(type, function (event) {
                if (!enabled) {
                    return;
                }
                event.preventDefault();
                self.volumeDragging = type !== 'touchend';
                const touch = type === 'touchend' ? event.changedTouches[0] : event.touches[0];
                setFromTouch(touch, type === 'touchend');
            }, { passive: false });
        });

        wrap.appendChild(slider);
        if (limit < 100) {
            const marker = document.createElement("div");
            marker.className = "sonos-volume-limit";
            // The thumb's centre travels from half a thumb in from each end, so place the line on that path.
            marker.style.left = `calc(var(--thumb-size) / 2 + (100% - var(--thumb-size)) * ${limit / 100})`;
            wrap.appendChild(marker);
        }
        return wrap;
    },

    createRoomGrid: function(group) {
        const grid = document.createElement("div");
        grid.className = "sonos-rooms";
        grid.style.gridTemplateColumns = `repeat(${this.config.columns}, 1fr)`;
        for (const button of Object.values(this.config.buttons)) {
            grid.appendChild(this.createRoomButton(button, group));
        }
        return grid;
    },

    createRoomButton: function(button, activeGroup) {
        const inActiveGroup = activeGroup && activeGroup.memberNames.includes(button.room);
        const lit = inActiveGroup && this.isPlaying(activeGroup);
        const available = !!this.groupOfRoom(button.room);

        const tile = document.createElement("div");
        tile.className = "sonos-room" + (lit ? " sonos-room-on" : "") + (available ? "" : " sonos-disabled");

        const symbol = document.createElement("i");
        symbol.className = "fa fa-" + button.symbol;
        const name = document.createElement("div");
        name.className = "sonos-room-name";
        name.textContent = button.label || button.room;
        tile.appendChild(symbol);
        tile.appendChild(name);

        if (available) {
            tile.addEventListener("click", () => this.roomClicked(button.room, activeGroup));
        }
        return tile;
    },

    // Tapping a lit room takes it out of the music (or pauses, if it is the only room); tapping an unlit
    // room adds it to whatever is playing, or starts that room on its own if nothing is.
    roomClicked: function(roomName, activeGroup) {
        const activeIsPlaying = this.isPlaying(activeGroup);
        const inActiveGroup = activeGroup && activeGroup.memberNames.includes(roomName);

        if (inActiveGroup && activeIsPlaying) {
            if (activeGroup.memberNames.length > 1) {
                activeGroup.memberNames = activeGroup.memberNames.filter(name => name !== roomName);
                this.sendCommand({ action: 'leave', room: roomName });
            } else {
                activeGroup.state = 'paused';
                this.sendCommand({ action: 'pause', room: roomName });
            }
        } else if (activeIsPlaying) {
            activeGroup.memberNames.push(roomName);
            this.sendCommand({ action: 'join', room: roomName, target: activeGroup.coordinatorName });
        } else {
            const roomGroup = this.groupOfRoom(roomName);
            this.rememberRoom(roomName);
            roomGroup.state = 'playing';
            this.sendCommand({ action: 'play', room: roomName });
        }
    },

    sendCommand: function(command, redraw = true) {
        this.sendSocketNotification('SONOS_COMMAND', command);
        if (command.action === 'join' || command.action === 'leave' || command.action === 'play') {
            this.rememberRoom(command.target || this.activeCoordinatorName || command.room);
        }
        if (redraw) {
            this.updateDom();
        }
    },

    notificationReceived: function(notification, payload) {
        if (notification === 'SONOS_VOLUME_LIMITS') {
            this.volumeLimits = { rooms: {}, group: null, ...payload };
            if (!this.isDraggingVolume()) {
                this.updateDom();
            }
        }
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === 'SONOS_STATE') {
            this.errorMessage = null;
            this.groups = payload.groups;
            this.roomVolumes = payload.roomVolumes;
            // Redrawing would interrupt a finger dragging the volume slider.
            if (!this.isDraggingVolume()) {
                this.updateDom();
            }
        } else if (notification === 'SONOS_ERROR') {
            this.errorMessage = payload;
            this.updateDom();
        }
    },

    isDraggingVolume: function() {
        return this.volumeDragging || !!document.querySelector(`#${this.identifier} .sonos-volume-slider:active`);
    },
});
