import {
    Meteor
} from "meteor/meteor";

var generateString = function(length, possible) {
    length = length || 5;
    possible = possible || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var text = "";
    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

var shuffle = function(array) {
    var a = array.slice(0);
    for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [a[i - 1], a[j]] = [a[j], a[i - 1]];
    }
    return a;
};

var roleCards = {
    2: ["hitler", "liberal"],
    3: ["hitler", "liberal", "liberal"],
    4: ["hitler", "liberal", "liberal", "liberal"],
    5: ["hitler", "fascist", "liberal", "liberal", "liberal"],
    6: ["hitler", "fascist", "liberal", "liberal", "liberal", "liberal"],
    7: ["hitler", "fascist", "fascist", "liberal", "liberal", "liberal", "liberal"],
    8: ["hitler", "fascist", "fascist", "liberal", "liberal", "liberal", "liberal", "liberal"],
    9: ["hitler", "fascist", "fascist", "fascist", "liberal", "liberal", "liberal", "liberal", "liberal"],
    10: ["hitler", "fascist", "fascist", "fascist", "liberal", "liberal", "liberal", "liberal", "liberal", "liberal"],
};

Meteor.methods({
    "newgame" ({
        name
    }) {
        var accessCode = generateString(6);
        name = name.trim();
        while (Rooms.find({
                accessCode: accessCode
            }).count() > 0) {
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
        Rooms.update(rid, {
            $set: {
                owner: pid
            }
        });
        return [rid, pid, accessCode];
    },
    "joingame" ({
        name,
        rid
    }) {
        var room = Rooms.findOne(rid);
        name = name.trim();
        if (!room)
            return;
        if (room.state !== "lobby")
            return;
        if (Players.find({
                rid: rid,
                name: name
            }).count() > 0)
            return;
        var pid = Players.insert({
            rid: rid,
            name: name
        });
        return [rid, pid];
    },
    "leavegame" ({
        pid
    }) {
        Players.remove(pid);
    },
    "startgame" ({
        rid
    }) {
        var players = Players.find({
            rid: rid
        }).fetch();
        var roles = shuffle(roleCards[players.length]);
        players.forEach(function(player, index) {
            Players.update(player._id, {
                $set: {
                    role: roles[index]
                }
            });
        });
        Rooms.update(rid, {
            $set: {
                state: "seating",
                players: []
            }
        });
    },
    "ready" ({
        pid
    }) {
        var player = Players.findOne(pid);
        var room = Rooms.findOne(player.rid);
        if (room.players.filter(function(player) {
                return player.pid == pid;
            }).length > 0) {
            return;
        }
        room.players.push({
            pid: player._id,
            name: player.name
        });
        var update = {
            players: room.players
        };
        if (Players.find({
                rid: room._id
            }).count() == room.players.length) {
            update["state"] = "ongoing";
            update["round"] = 1;
            update["started"] = new Date().getTime();
            update["current_president"] = Math.floor(Math.random() * room.players.length);
            update["current_chancellor"] = -1;
        }
        Rooms.update(player.rid, {
            $set: update
        });
    }
});

Meteor.publish("rooms", function(code) {
    return Rooms.find({
        accessCode: code
    });
});

Meteor.publish("players", function(rid) {
    return Players.find({
        rid: rid
    });
});