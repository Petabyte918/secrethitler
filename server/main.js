import { Meteor } from "meteor/meteor";

var generateString = function(length, possible) {
    length = length || 5;
    possible = possible || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var text = "";
    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

Meteor.methods({
	"newgame"({ name }) {
        var accessCode = generateString(6);
        while (Rooms.find({ accessCode: accessCode }).count() > 0) {
            accessCode = generateString(6);
        }
        var rid = Rooms.insert({
            accessCode: accessCode,
            started: new Date().getTime(),
            state: "lobby"
        });
        var pid = Players.insert({
            rid: rid,
            name: name
        });
        Rooms.update(rid, { $set: { owner: pid } });
        return [rid, pid, accessCode];
	},
    "joingame"({ name, rid }) {
        var room = Rooms.findOne(rid);
        if (!room)
            return;
        var pid = Players.insert({
            rid: rid,
            name: name
        });
        return [rid, pid]
    },
    "leavegame"({ pid }) {
        Players.remove(pid);
    }
});

Meteor.publish("rooms", function(code) {
    return Rooms.find({ accessCode: code });
});

Meteor.publish("players", function(rid) {
    return Players.find({ rid: rid });
});