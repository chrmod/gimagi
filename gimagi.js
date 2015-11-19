Meetings = new Mongo.Collection("meetings");

if (Meteor.isClient) {

  var saveMeeting = function (id, name, from, to, duration, description, people, pendingon, constraints) {
    var status = pendingon.length == 0 ? 'done' : 'pending';
    if (id) {
      Meetings.update(this._id, {
        name: name,
        from: from,
        to: to,
        duration: duration,
        description: description,
        people: people,
        pendingon: pendingon,
        constraints: constraints,
        status: 'pending'
      });
    } else {
      Meetings.insert({
        name: name,
        from: from,
        to: to,
        duration: duration,
        description: description,
        people: people,
        pendingon: pendingon,
        constraints: constraints,
        createdAt: new Date(),
        status: 'pending'
      });
    }
  }

  var me = {
    email: 'email@me.com',
    name: 'Khaled Tantawy'
  }

  Template.pending_on_me.events({
    'click #agree': function () {
      this.pendingon.forEach(function(item, index) {
        if(item == me.name) {
          this.pendingon.splice(index, 1);
          return;
        }
      });
      saveMeeting(this._id, this.name, this.from, this.to, this.duration, this.description, this.people, this.pendingon, this.constraints);
    },
    'click #opt-out': function () {
      this.people.forEach(function(item, index) {
        if(item == me.name) {
          this.people.splice(index, 1);
        }
      });
      this.pendingon.forEach(function(item, index) {
        if(item == me.name) {
          this.pendingon.splice(index, 1);
        }
      });
      saveMeeting(this._id, this.name, this.from, this.to, this.duration, this.description, this.people, this.pendingon, this.constraints);
    }
  });

  Template.home.helpers({
    counter: function () {
      return Meetings.find().fetch().length;
    },
    meetings: function () {
      return Meetings.find().fetch();
    },
    detailsMode: function () {
      return Template.instance().detailsMode.get();
    }
  });

  Template.home.created = function() {
    this.detailsMode = new ReactiveVar(false);
  };

  Template.meeting_box.helpers({
    showDetails: function () {
      return Session.get("current_meeting_id") === this._id;
    },
    isPendingOnMe: function () {
      return this.pendingon.indexOf(me.name) > -1 ? "yes" : "no";
    }
  })

  Template.meeting_box.events({
    'click .meeting-box': function (event, template) {
      Session.set("current_meeting_id", this._id);
      // var detailsMode = template.detailsMode.get();
      // template.detailsMode.set(!detailsMode);
    }
  })

  Template.meeting_details.created = function() {
    this.detailsMode = new ReactiveVar(false);
  };

  Template.meeting_details.events({
    'submit form': function (event) {
      event.preventDefault();

      var name = event.target.name.value;
      var description = event.target.description.value;
      var people = event.target.people.value.split(";");
      people.push(me.name);
      var pendingon = event.target.people.value.split(";");
      var constraints = event.target.constraints.value.split(";");
      var from = event.target.from.value;
      var to = event.target.to.value;
      var duration = event.target.duration.value;

      saveMeeting(this._id, name, from, to, duration, description, people, pendingon, constraints);

    }
  });

  Template.home.events({
    'click .show-details': function(event,template) {
      var detailsMode = template.detailsMode.get();
      template.detailsMode.set(!detailsMode);
      Session.set("current_meeting_id", 0);
    }
  });

  Accounts.ui.config({
    requestPermissions: {
      google: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/calendar.readonly'
      ]
    },
    requestOfflineToken: {
      google: true
    },
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
