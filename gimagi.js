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
