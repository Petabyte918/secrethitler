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
        "lobby": "lobby"
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
})

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
            if (player._id == pid)
                player.current = true;
            return player;
        });
    }
});
