Events = new Mongo.Collection("events");

if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.hello.helpers({
    counter: function () {
      return Events.find().fetch().length;
    },
    freeBusy: function () {
 //     return GoogleApi.get("calendar/v3/users/me/calendarList")
//GoogleApi.get("calendar/v3/users/me/calendarList", {user: user })
    }
  });


  Template.hello.events({
    'click button': function () {
      // increment the counter when button is clicked
      Events.insert({'type': 'click'})
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
