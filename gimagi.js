Events = new Mongo.Collection("events");

if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.hello.helpers({
    counter: function () {
      return Events.find().fetch().length;
    }
  });

  Template.hello.events({
    'click button': function () {
      // increment the counter when button is clicked
      Events.insert({'type': 'click'})
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
