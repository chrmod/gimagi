
var IntervalSet = function(intervals) {
  if (!intervals) {
    this.intervals = [];
  } else {
    var _intervals = [];
    intervals.forEach(function(i) {
      _intervals.push(moment.range(moment(i.start), moment(i.end)));
    });
    this.intervals = _intervals;
  }
}

IntervalSet.prototype = {

  addDateRange: function(start, end) {
    start = moment(start);
    end = moment(end);
    if (start.isSame(end, 'day')) {
      end.endOf('day');
    }
    var interval = moment.range(moment(start), moment(end)),
      self = this;
    interval.by('days', function(start) {
      var day_range = moment.range(start, moment(start).endOf('day'));
      day_range = day_range.intersect(interval);
      self.intervals.push(day_range);
    });
    return this;
  },

  betweenHours: function(s, f) {
    this.intervals = this.intervals.map(function(r) {
      var start_of_day = moment(r.start).startOf('day'),
        start = moment(start_of_day).add({'hours': s}),
        end = moment(start_of_day).add({'hours': f}),
        range = moment.range(start, end);
      range = range.intersect(r);
      return range;
    });
    return this;
  },

  notBetweenHours: function(s, f) {
    var new_ranges = [];
    this.intervals.forEach(function(r) {
      var start_of_day = moment(r.start).startOf('day'),
        start = moment(start_of_day).add({'hours': s}),
        end = moment(start_of_day).add({'hours': f}),
        exclude = moment.range(start, end);
      if (r.overlaps(exclude)) {
        r.subtract(exclude).forEach(function(r) {
            new_ranges.push(r);
        });
      } else {
        new_ranges.push(r);
      }
    });
    this.intervals = new_ranges;
    return this;
  },

  removeInterval: function(start, end) {
    var interval = moment.range(moment(start), moment(end)),
      new_ranges = [];
    this.intervals.forEach(function(r) {
      if (r.overlaps(interval)) {
        r.subtract(interval).forEach(function(r2) {
            new_ranges.push(r2);
        });
      } else {
        new_ranges.push(r);
      }
    });
    this.intervals = new_ranges;
    return this;
  },

  filterForLength: function(duration) {
    this.intervals = this.intervals.filter(function(r) {
      return r.diff('minutes') >= duration.asMinutes();
    });
    return this;
  },

  getCandidates: function(duration, fidelity, max_results) {
    var self = this,
      results = [];
    if (!max_results) {
      max_results = 0;
    }
    this.filterForLength(duration);
    for (var i = 0; i<this.intervals.length; i++) {
      var interval = this.intervals[i],
        start = interval.start,
        end = moment(start).add(duration);
      while (end <= interval.end) {
        results.push(moment.range(start, end));

        start = moment(start).add(fidelity);
        end = moment(end).add(fidelity);

        if (max_results > 0 && results.length >= max_results) {
            return results
        }
      }
    };
    return results;
  },
}

Meetings = new Mongo.Collection("meetings");

if (Meteor.isClient) {

  var saveMeeting = function (id, name, from, to, duration, description, people, pendingon, constraints) {
    var status = pendingon.length == 0 ? 'done' : 'pending';
    console.log(id);
    if (id) {
      console.log('update');
      Meetings.update(id, {
        $set: {name: name,
          from: from,
          to: to,
          duration: duration,
          description: description,
          people: people,
          pendingon: pendingon,
          constraints: constraints,
          status: status
        }
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
      }, function(err, id) {
        if (err) {
          console.log(err);
        } else {
          Meteor.call('propose', id);
        }
      });
    }
  }

  Template.suggest_other.events({
    'click #proposal': function (event, template) {
      var pendingon = template.data.people.slice(),
        meeting = template.data;
      var i = pendingon.indexOf(Meteor.user().profile.name);
      if (i >= 0) {
        pendingon.splice(i, 1);
      }
      // var rejected = moment.range(moment(meeting.current_proposal[0]), moment(meeting.current_proposal[1])),
      //   intervals = new IntervalSet(meeting.intervals);
      // intervals.removeInterval(rejected.start, rejected.end);
      // var proposals = intervals.getCandidates(moment.duration({'minutes': meeting.duration}), moment.duration({'minutes': 30}), 5);
      Meetings.update(meeting._id, {
        $set: { current_proposal: this,
                status: 'pending',
                pendingon: pendingon,
                //proposals: proposals,
                //intervals: intervals.intervals
        }
      });
    }
  });

  Template.pending_on_me.created = function () {
    this.suggestMode = new ReactiveVar(false);
  }

  Template.pending_on_me.helpers({
    suggestMode: function () {
      return Template.instance().suggestMode.get();
    }
  });


  Template.pending_on_me.events({
    'click #agree': function () {
      var i = this.pendingon.indexOf(Meteor.user().profile.name);
      if (i >= 0) {
        this.pendingon.splice(i, 1);
      }
      if(this.pendingon.length == 0) {
        this.status = 'ready'
      }
      console.log(this);
      Meetings.update(this._id, {
        $set: { pendingon: this.pendingon,
                status: this.status }
      });
    },
    'click #opt-out': function () {
      var i = this.pendingon.indexOf(Meteor.user().profile.name);
      if (i >= 0) {
        this.pendingon.splice(i, 1);
      }
      i = this.people.indexOf(Meteor.user().profile.name);
      if (i >= 0) {
        this.people.splice(i, 1);
      }
      if(this.pendingon.length == 0) {
        this.status = 'ready'
      }
      Meetings.update(this._id, {
        $set: {
          pendingon: this.pendingon,
          people: this.people,
          status: this.status
        }
      });
    },
    'click #suggest-other': function (event, template) {
      // var suggestMode = template.suggestMode.get();
      template.suggestMode.set(true);
    }
  });

  Template.body.helpers({
    userName() {
      return Meteor.user().profile.name.split(" ")[0];
    }
  })

  Template.home.helpers({
    counter: function () {
      return Meetings.find().fetch().length;
    },
    pendingMeetings() {
      var me = Meteor.user().profile.name;
      return Meetings.find({people: Meteor.user().profile.name}).fetch().filter(function (meeting) {
        return meeting.pendingon.indexOf(me) > -1;
      });
    },
    meetings: function () {
      var me = Meteor.user().profile.name;
      return Meetings.find({people: Meteor.user().profile.name}).fetch().filter(function (meeting) {
        return meeting.pendingon.indexOf(me) == -1;
      });
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
      return this.pendingon.indexOf(Meteor.user().profile.name) > -1;
    },
    niceDuration() {
      return moment.duration(Number(this.duration), 'minutes').asHours();
    },
    niceProposal() {
      return moment(this.current_proposal[0]).format("dddd, MMM Do \\at HH:mm");
    },
  })

  Template.meeting_box_status.helpers({
    acceptedCount() {
      return this.people.length - this.pendingon.length - 1;
    },
    waitingCount() {
      return this.pendingon.length;
    }
  });

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
    'submit form': function (event, template) {
      var me = Meteor.user().profile;
      event.preventDefault();

      var name = event.target.name.value;
      var description = event.target.description.value;
      var people = event.target.people.value.split(";");
      for(var i = 0; i < people.length; i++) {
        if(people[i] == "") {
          people.splice(i, 1);
        }
      }
      if(people.indexOf(me.name) == -1) {
        people.push(me.name);
      }
      var pendingon = people;
      var constraints = event.target.constraints.value.split(";");
      var from = event.target.from.value;
      var to = event.target.to.value;
      var duration = event.target.duration.value;

      saveMeeting(this._id, name, from, to, duration, description, people, pendingon, constraints);
      template.detailsMode.set(false);
      Session.set("current_meeting_id", 0);

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
     var xxy = function(){}
  });

  Meteor.methods({
    propose: function(id) {
      var meeting = Meetings.findOne({'_id': id});

      // check(meeting.people, Array);
      // check(meeting.from, Date);
      // check(meeting.to, Date);
      // check(meeting.constraints, Array);
      // check(meeting.duration, Number);

      var intervals = new IntervalSet(),
        from = moment(moment.max(meeting.from, moment())),
        to = moment(meeting.to);
      to.endOf('day');

      intervals.addDateRange(from, to);
      if (meeting.constraints.indexOf('work_hours') > -1) {
        intervals.betweenHours(9, 18);
      }
      if (meeting.constraints.indexOf('not_lunch') > -1) {
        intervals.notBetweenHours(12, 14);
      }
      if (meeting.constraints.indexOf('evening') > -1) {
        intervals.betweenHours(18, 23);
      }
      if (meeting.constraints.indexOf('morning') > -1) {
        intervals.betweenHours(7, 12);
      }
      if (meeting.constraints.indexOf('afternoon') > -1) {
        intervals.betweenHours(12, 18);
      }

      meeting.people.forEach(function(name) {
        var user = Meteor.users.findOne({profile: {name: name}}),
          calendars = GoogleApi.get("calendar/v3/users/me/calendarList", {user: user}),
          calendar_ids = calendars.items.filter(function(item) { return 'primary' in item && item['primary'] == true}).map(function(e) { return e.id; }),
          data = {
            "timeMin": from.toISOString(),
            "timeMax": to.toISOString(),
            "items": calendar_ids.map(function(id) { return {"id": id}})
          },
          freebusy = GoogleApi.post("calendar/v3/freeBusy", {user: user, data: data});
        for (var calendar in freebusy.calendars) {
          freebusy.calendars[calendar].busy.forEach(function(r){
            intervals.removeInterval(moment(r.start), moment(r.end));
          });
        }
      });

      var proposals = intervals.getCandidates(moment.duration({'minutes': meeting.duration}), moment.duration({'minutes': 30}), 6),
        current_proposal = proposals.shift();
      console.log(proposals);
      if (proposals.length > 0) {
        Meetings.update(id, {
          $set: {
            intervals: intervals.intervals,
            current_proposal: [current_proposal.start.toDate(), current_proposal.end.toDate()],
            proposals: proposals.map(function(i) {
              return [i.start.toDate(), i.end.toDate()]; })
          }
        });
      }
    }
  });
}
