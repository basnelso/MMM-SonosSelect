var NodeHelper = require('node_helper');
const { Sonos, AsyncDeviceDiscovery } = require('sonos');

module.exports = NodeHelper.create({

    start: function() {
        console.log('Starting node_helper for module [' + this.name + ']');
        this.seedHost = null;
        this.pollTimer = null;
        // Commands change the system state; polling straight after one can still report the old state,
        // so polls are skipped briefly after any command.
        this.pauseUpdatesUntil = 0;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === 'SONOS_START') {
            this.config = payload;
            if (!this.pollTimer) {
                this.poll();
                this.pollTimer = setInterval(() => this.poll(), this.config.updateInterval);
            }
        } else if (notification === 'SONOS_COMMAND') {
            this.runCommand(payload);
        }
    },

    // Any speaker can describe the whole system, so one known address is enough. Find one with SSDP
    // instead of configuring an IP, since speaker addresses change when the router hands out new leases.
    getSeedDevice: async function() {
        if (!this.seedHost) {
            const device = await new AsyncDeviceDiscovery().discover({ timeout: 5000 });
            this.seedHost = device.host;
            console.log('Found Sonos system via ' + this.seedHost);
        }
        return new Sonos(this.seedHost);
    },

    // Returns one entry per room (zone), with the group it is in. Stereo pairs and subs show up as several
    // members with the same zone name, so rooms are de-duplicated by name.
    getSystemState: async function() {
        const groups = await (await this.getSeedDevice()).getAllGroups();
        const rooms = {};
        const groupSummaries = [];

        for (const group of groups) {
            const coordinatorHost = group.host;
            const coordinatorName = group.ZoneGroupMember.find(member => member.UUID === group.Coordinator)?.ZoneName;
            const memberNames = [...new Set(group.ZoneGroupMember.map(member => member.ZoneName))];

            for (const member of group.ZoneGroupMember) {
                // The second speaker of a stereo pair is marked Invisible and rejects group commands
                // (UPnP error 1023), so always address the pair through its main speaker.
                if (member.Invisible === '1') {
                    continue;
                }
                rooms[member.ZoneName] = { host: new URL(member.Location).hostname, groupCoordinatorHost: coordinatorHost };
            }
            groupSummaries.push({ coordinatorHost, coordinatorName, memberNames });
        }
        return { rooms, groupSummaries };
    },

    poll: async function() {
        if (Date.now() < this.pauseUpdatesUntil) {
            return;
        }
        try {
            const { rooms, groupSummaries } = await this.getSystemState();
            const groups = await Promise.all(groupSummaries.map(group => this.describeGroup(group)));
            const roomVolumes = {};
            await Promise.all(Object.keys(rooms).map(async roomName => {
                roomVolumes[roomName] = await new Sonos(rooms[roomName].host).getVolume().catch(() => null);
            }));
            this.lastRooms = rooms;
            this.sendSocketNotification('SONOS_STATE', { groups, roomVolumes });
        } catch (error) {
            console.error('MMM-SonosSelect: could not read Sonos state:', error.message);
            // The seed speaker may have changed address or be switched off; rediscover next time.
            this.seedHost = null;
            this.sendSocketNotification('SONOS_ERROR', error.message);
        }
    },

    describeGroup: async function(group) {
        const coordinator = new Sonos(group.coordinatorHost);
        const [state, groupVolume, mediaInfo] = await Promise.all([
            coordinator.getCurrentState(),
            this.getGroupVolume(coordinator),
            coordinator.avTransportService().GetMediaInfo().catch(() => ({})),
        ]);
        return {
            coordinatorHost: group.coordinatorHost,
            coordinatorName: group.coordinatorName,
            memberNames: group.memberNames,
            state,
            groupVolume,
            source: this.classifySource(mediaInfo.CurrentURI || ''),
        };
    },

    // The panel follows Spotify ahead of TV audio, so tell them apart by the stream URI:
    // TV/HDMI is x-sonos-htastream, Spotify Connect is x-sonos-vli:...spotify.
    classifySource: function(uri) {
        if (uri.startsWith('x-sonos-htastream:')) {
            return 'tv';
        }
        if (/spotify/i.test(uri)) {
            return 'spotify';
        }
        return uri ? 'music' : 'none';
    },

    getGroupVolume: async function(coordinator) {
        const { GroupRenderingControl } = require('sonos').Services;
        // The library already unwraps the SOAP response, so this resolves to the volume number itself.
        const volume = await new GroupRenderingControl(coordinator.host, coordinator.port).GetGroupVolume().catch(() => null);
        return volume === null ? null : Number(volume);
    },

    runCommand: async function(command) {
        this.pauseUpdatesUntil = Date.now() + 2500;
        try {
            const rooms = this.lastRooms || (await this.getSystemState()).rooms;
            const room = rooms[command.room];
            if (!room) {
                throw new Error('Unknown room ' + command.room);
            }
            const roomDevice = new Sonos(room.host);
            const coordinator = new Sonos(room.groupCoordinatorHost);

            switch (command.action) {
                case 'play':
                    await coordinator.play();
                    break;
                case 'pause':
                    await coordinator.pause();
                    break;
                case 'next':
                    await coordinator.next();
                    break;
                case 'previous':
                    await coordinator.previous();
                    break;
                case 'join':
                    await roomDevice.joinGroup(command.target);
                    break;
                case 'leave':
                    await roomDevice.leaveGroup();
                    break;
                case 'groupVolume': {
                    const { GroupRenderingControl } = require('sonos').Services;
                    await new GroupRenderingControl(coordinator.host, coordinator.port).SetGroupVolume(command.volume);
                    break;
                }
                case 'roomVolume':
                    await roomDevice.setVolume(command.volume);
                    break;
                default:
                    throw new Error('Unknown action ' + command.action);
            }
            console.log('MMM-SonosSelect: sent', JSON.stringify(command));
        } catch (error) {
            console.error('MMM-SonosSelect: command failed:', JSON.stringify(command), error.message);
        }
        this.pauseUpdatesUntil = 0;
        setTimeout(() => this.poll(), 500);
    }
});
