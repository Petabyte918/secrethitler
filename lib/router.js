Router.route("/", function() {
    this.render("main");
    Session.set("view", "startmenu");
});

Router.route("/:accessCode", function() {
    var accessCode = this.params.accessCode;
    this.render("main");
    Session.set("code", accessCode);
    Session.set("view", "joingame");
});