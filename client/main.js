FlashMessages.configure({
    autoHide: true,
    autoScroll: false
});

Tracker.autorun(function roomstate() {
    if (!Session.get("view"))
        Session.set("view", "startmenu");

    var rid = Session.get("rid");
    var pid = Session.get("pid");

    if (!rid || !pid)
        return;

    var room = Rooms.findOne(rid);
    var player = Players.findOne(pid);

    if (!room || !player) {
        Session.set("rid", null);
        Session.set("pid", null);
        Session.set("view", "startmenu");
        return;
    }

    Session.set("view", {
        "lobby": "lobby",
        "seating": "seating"
    }[room.state] || null);
});

Template.main.helpers({
    view: function() {
        return Session.get("view");
    }
});

Template.startmenu.events({
    "click #newgame-btn": function() {
        Session.set("view", "newgame");
    },
    "click #joingame-btn": function() {
        Session.set("view", "joingame");
    }
});

Template.newgame.events({
    "click .back-btn": function() {
        Session.set("view", "startmenu");
    },
    "submit #newgame-form": function(event) {
        var name = event.target.name.value;
        if (!name)
            return false;

        Meteor.call("newgame", {
            name: name
        }, (err, res) => {
            if (err)
                console.error(err);
            [rid, pid, code] = res;
            Meteor.subscribe("rooms", code);
            Meteor.subscribe("players", rid, function() {
                Session.set("rid", rid);
                Session.set("pid", pid);
                Session.set("view", "lobby");
            });
        });
        return false;
    }
});

Template.joingame.events({
    "click .back-btn": function() {
        Session.set("view", "startmenu");
    },
    "submit #joingame-form": function() {
        var code = event.target.code.value;
        var name = event.target.name.value;
        if (!name)
            return false;

        code = code.trim().toUpperCase();
        Meteor.subscribe("rooms", code, function() {
            var room = Rooms.findOne({ accessCode: code });
            if (!room)
                return FlashMessages.sendError("Invalid access code.");
            if (room.state !== "lobby")
                return FlashMessages.sendError("Game has already started!");
            Meteor.subscribe("players", room._id);
            Meteor.call("joingame", {
                name: name,
                rid: room._id
            }, (err, res) => {
                if (err)
                    console.error(err);
                [rid, pid] = res;
                Session.set("rid", rid);
                Session.set("pid", pid);
                Session.set("view", "lobby");
            });
        });
        return false;
    }
});

Template.lobby.events({
    "click .remove-btn": function(event) {
        var pid = $(event.currentTarget).data("pid");
        console.log(pid);
        Meteor.call("leavegame", { pid: pid })
    },
    "click #start-btn": function() {
        var rid = Session.get("rid");
        Meteor.call("startgame", { rid: rid });
    },
    "click #quit-btn": function() {
        var pid = Session.get("pid");
        Meteor.call("leavegame", {
            pid: pid
        }, (err) => {
            if (err)
                console.error(err);
            Session.set("rid", null);
            Session.set("pid", null);
            Session.set("view", "startmenu");
        });
    }
});

Template.lobby.helpers({
    room: function() {
        var rid;
        if (rid = Session.get("rid")) {
            return Rooms.findOne(rid);
        }
    },
    players: function() {
        var pid = Session.get("pid");
        var rid = Session.get("rid");
        var room = Rooms.findOne(rid);
        if (!room)
            return null;
        return Players.find({ rid: rid }).fetch().map(function(player) {
            player.current = player._id == pid;
            return player;
        });
    },
    owner: function() {
        var pid = Session.get("pid");
        var rid = Session.get("rid");
        var room = Rooms.findOne(rid);
        return pid == room.owner;
    },
    ready: function(players) {
        var attributes = { };
        if (!(players.length >= 5 || players.length == 2)) {
            attributes.disabled = false;
        }
        return attributes;
    },
});

Template.seating.events({
    "click #ready-btn": function() {
        Meteor.call("ready", { pid: pid }, (err) => {
            if (err)
                console.error(err);
        });
    }
});

Template.seating.helpers({
    canready: function() {
        var attributes = {};
        var pid = Session.get("pid");
        var player = Players.findOne(pid);
        var room = Rooms.findOne(player.rid);
        if (room.players.filter(function(player) {
            return player.pid == pid;
        }).length > 0) {
            attributes["disabled"] = true;
        }
        return attributes;
    },
    role: function() {
        var pid = Session.get("pid");
        var player = Players.findOne(pid);
        return {
            "liberal": "Liberal",
            "fascist": "Fascist",
            "hitler": "Hitler"
        }[player.role];
    },
    players: function() {
        var rid = Session.get("rid");
        var room = Rooms.findOne(rid);
        return room.players;
    },
});