import {
    Meteor
} from "meteor/meteor";
import {
    Random
} from "meteor/random";

var deck = ["fascist", "fascist", "fascist", "fascist", "fascist", "fascist", "fascist", "fascist", "fascist", "fascist", "fascist", "liberal", "liberal", "liberal", "liberal", "liberal", "liberal"];

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
        var accessCode = Random.hexString(6);
        name = name.trim();
        while (Rooms.find({
                accessCode: accessCode
            }).count() > 0) {
            accessCode = Random.hexString(6);
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
        var fascists = [];
        var roles = _.shuffle(roleCards[players.length]);
        players.forEach(function(player, index) {
            Players.update(player._id, {
                $set: {
                    role: roles[index]
                }
            });
            if (roles[index] == "fascist" || roles[index] == "hitler") {
                fascists.push({
                    name: player.name,
                    pid: player._id,
                    hitler: roles[index] == "hitler"
                });
            }
        });
        Rooms.update(rid, {
            $set: {
                state: "seating",
                players: [],
                teamfascist: fascists,
                size: players.length
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
        var index = room.players.length;
        room.players.push({
            pid: player._id,
            name: player.name,
            role: player.role
        });
        var update = {
            players: room.players
        };
        if (Players.find({
                rid: room._id
            }).count() == room.players.length) {
            update.state = "ongoing";
            update.tracker = 0;
            update.trackerfull = "";
            update.drawpile = _.shuffle(deck);
            update.discardpile = [];
            update.choices = [];
            update.round = 1;
            update.started = new Date().getTime();
            update.voted = false;
            update.votes = {};
            update.voteresult = 0;
            update.current_president = Math.floor(Math.random() * room.players.length);
            update.current_chancellor = -1;
            update.ruledout = [];
            update.liberal = 0;
            update.fascist = 0;
        }
        Players.update(pid, {
            $set: {
                index: index
            }
        })
        Rooms.update(player.rid, {
            $set: update
        });
    },
    "pickchancellor" ({
        pid
    }) {
        var player = Players.findOne(pid);
        if (!player)
            return;
        var room = Rooms.findOne(player.rid);
        if (room.current_chancellor > -1)
            return;
        if (player.index == room.current_president)
            return;
        if (_.contains(room.ruledout, player._id))
            return;
        Rooms.update(player.rid, {
            $set: {
                current_chancellor: player.index
            }
        });
    },
    "vote" ({
        pid,
        vote
    }) {
        var player = Players.findOne(pid);
        var room = Rooms.findOne(player.rid);
        var update = {
            votes: room.votes
        };
        update.votes[pid] = vote;
        if (_.size(update.votes) == _.size(room.players)) {
            update.voted = true;
            update.voteresult = _.countBy(_.values(update.votes), (value) => {
                return value ? "true" : "false";
            }).true > (_.size(room.players) / 2) ? 1 : -1;
            if (update.voteresult == 1) {
                update.tracker = 0;
                if (room.fascist >= 3 && room.players[room.current_chancellor].role == "hitler") {
                    update.state = "gameover";
                    update.winner = "fascists";
                    update.reason = "hitler has been elected!";
                    update.players = room.players;
                    for (var i = 0; i < room.players.length; i += 1) {
                        update.players[i].side = Players.findOne(room.players[i].pid).role;
                    }
                } else {
                    var drawpile = room.drawpile;
                    if (drawpile.length < 3) {
                        drawpile = drawpile.concat(room.discardpile);
                        update.discardpile = [];
                    }
                    _.shuffle(drawpile);
                    update.choices = drawpile.splice(0, 3);
                    update.drawpile = drawpile;
                }
            } else {
                update.tracker = room.tracker + 1;
                if (update.tracker == 3) {
                    update.drawpile = room.drawpile;
                    var card = update.drawpile.splice(0, 1);
                    if (card == "liberal")
                        update.liberal = room.liberal + 1;
                    else if (card == "fascist")
                        update.fascist = room.fascist + 1;
                    update.trackerfull = `a ${card} policy has been enacted!`;
                    update.tracker = 0;
                }
            }
        }
        Rooms.update(player.rid, {
            $set: update
        });
    },
    "failcontinue" ({
        pid
    }) {
        var player = Players.findOne(pid);
        if (!player)
            return;
        var room = Rooms.findOne(player.rid);
        var update = {
            votes: room.votes
        };
        delete update.votes[pid];
        if (_.size(update.votes) == 0) {
            update.trackerfull = "";
            update.round = room.round + 1;
            update.voted = false;
            update.votes = {};
            update.voteresult = 0;
            update.ruledout = [room.players[room.current_president].pid, room.players[room.current_chancellor].pid];
            update.current_president = (room.current_president + 1) % _.size(room.players);
            update.current_chancellor = -1;
        }
        Rooms.update(player.rid, {
            $set: update
        });
    },
    "discard" ({
        pid,
        card
    }) {
        var player = Players.findOne(pid);
        if (!player)
            return;
        var room = Rooms.findOne(player.rid);
        if (!(card == "liberal" || card == "fascist"))
            return;
        if ((room.choices.length == 3 && room.players[room.current_president].pid != pid) || (room.choices.length == 2 && room.players[room.current_chancellor].pid != pid))
            return;
        var index = room.choices.indexOf(card);
        room.choices.splice(index, 1);
        var update = {
            choices: room.choices,
            discardpile: room.discardpile.concat([card])
        };
        if (room.choices.length == 1) {
            console.log(room.choices);
            if (room.choices[0] == "liberal")
                update.liberal = room.liberal + 1;
            else if (room.choices[0] == "fascist")
                update.fascist = room.fascist + 1;
            update.round = room.round + 1;
            update.choices = [];
            update.voted = false;
            update.votes = {};
            update.voteresult = 0;
            update.ruledout = [room.players[room.current_president].pid, room.players[room.current_chancellor].pid];
            update.current_president = (room.current_president + 1) % _.size(room.players);
            update.current_chancellor = -1;
            if (update.liberal == 5 || update.fascist == 6) {
                update.state = "gameover";
                if (update.liberal == 5) {
                    update.winner = "liberals";
                    update.reason = "liberals have passed 5 policies!";
                } else if (update.fascist == 6) {
                    update.winner = "fascists";
                    update.reason = "fascists have passed 6 policies!";
                }
                update.players = room.players;
                for (var i = 0; i < room.players.length; i += 1) {
                    update.players[i].side = Players.findOne(room.players[i].pid).role;
                }
            }
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