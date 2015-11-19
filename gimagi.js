var IntervalSet = function(intervals) {
  if (!intervals) {
    this.intervals = []
  } else {
    this.intervals = intervals;
  }
}

IntervalSet.prototype = {

  addDateRange: function(start, end) {
    var interval = moment.range(moment(start), moment(end)),
      self = this;
    interval.by('days', function(start) {
      var day_range = moment.range(start, moment(start).endOf('day'));
      day_range.intersect(interval);
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
      range.intersect(r);
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

  Meteor.methods({
    propose: function(id) {
      var meeting = Meetings.findOne({'_id': id});

      check(meeting.members, Array);
      check(meeting.from, Date);
      check(meeting.to, Date);
      check(meeting.constraints, Array);
      check(meeting.duration, Number);

      var intervals = new IntervalSet();
      intervals.addDateRange(meeting.from, meeting.to);
      if (meeting.constraints.indexOf('work_hours') > -1) {
        intervals.betweenHours(9, 18);
      }
      if (meeting.constraints.indexOf('not_lunch') > -1) {
        intervals.notBetweenHours(12, 14);
      }

      meeting.members.forEach(function(name) {
        var user = Meteor.users.findOne({profile: {name: name}}),
          calendars = GoogleApi.get("calendar/v3/users/me/calendarList", {user: user}),
          calendar_ids = calendars.items.filter(function(item) { return 'primary' in item && item['primary'] == true}).map(function(e) { return e.id; }),
          data = {
            "timeMin": moment(meeting.from).toISOString(),
            "timeMax": moment(meeting.to).toISOString(),
            "items": calendar_ids.map(function(id) { return {"id": id}})
          },
          freebusy = GoogleApi.post("calendar/v3/freeBusy", {user: user, data: data});
        for (var calendar in freebusy.calendars) {
          freebusy.calendars[calendar].busy.forEach(function(r){
            intervals.removeInterval(moment(r.start), moment(r.end));
          });
        }
      });

      Meetings.update(id, {
        $set: {
          proposals: intervals.getCandidates(moment.duration({'minutes': meeting.duration}), moment.duration({'minutes': 30}), 10)
        }
      });

    }
  });
}
