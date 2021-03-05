var NodeHelper = require('node_helper');
var request = require('request');

module.exports = NodeHelper.create({

    start: function() {
        console.log('Starting node_helper for module [' + this.name + ']');
    },

    getSonosStatus(url) {
        var self = this;
        request(url, {method: 'GET'}, function(err, res, body) {
            if ((err) || (res.statusCode !== 200)) {
                console.log("MMM-SonosSelect: GET request failed.")
                self.sendSocketNotification('SONOS_DATA_ERR', data);
            } else {
                var data = JSON.parse(body);
                self.sendSocketNotification('SONOS_DATA', data);
            }

        });    
    },

    sendGet(url) {
        request.get(url);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SONOS_GET_DATA") {
            this.getSonosStatus(payload);
        } else if (notification == "SONOS_BUTTON_CLICK") {
            this.sendGet(payload);
        }
    }
});