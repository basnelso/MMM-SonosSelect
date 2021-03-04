var NodeHelper = require('node_helper');
var request = require('request');

module.exports = NodeHelper.create({

    start: function() {
        console.log('Starting node_helper for module [' + this.name + ']');
    },

    sendGetRequest(url) {
        request.get(url);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_SONOS") {
            this.sendGetRequest(payload);
        }
    }
});