/* Lakeside Inn booking page: the "legacy" app. jQuery 3 + jQuery UI 1.13 Datepicker, written the way such pages were. */
$(function () {
  'use strict';

  var FIRST_NIGHT = new Date(2026, 10, 10); // bookings open on 10 Nov 2026
  var LAST_NIGHT = new Date(2027, 10, 15);
  var BOOKED = ['11/24/2026', '11/25/2026', '11/26/2026'];
  var DAY = 24 * 60 * 60 * 1000;

  function fmt(date) {
    return $.datepicker.formatDate('mm/dd/yy', date);
  }

  function booked(date) {
    if (BOOKED.indexOf(fmt(date)) !== -1) return [false, 'booked', 'Fully booked'];
    return [true, '', ''];
  }

  function parse(id) {
    try {
      return $.datepicker.parseDate('mm/dd/yy', $(id).val());
    } catch (e) {
      return null;
    }
  }

  function updateNights() {
    var inDate = parse('#checkin');
    var outDate = parse('#checkout');
    if (!inDate || !outDate) {
      $('#nights').text('Choose your dates');
      return;
    }
    var n = Math.round((outDate - inDate) / DAY);
    $('#nights').text(n === 1 ? '1 night' : n + ' nights');
  }

  // Check-out must be at least one night after check-in.
  function checkinChosen(dateText) {
    if (!dateText) {
      // Ctrl+End cleared check-in: any later check-out is allowed again.
      $('#checkout').datepicker('option', 'minDate', new Date(2026, 10, 11));
      updateNights();
      return;
    }
    var inDate = $.datepicker.parseDate('mm/dd/yy', dateText);
    var earliestOut = new Date(inDate.getTime() + DAY);
    $('#checkout').datepicker('option', 'minDate', earliestOut);
    var outDate = parse('#checkout');
    if (outDate && outDate <= inDate) $('#checkout').val('');
    updateNights();
  }

  $('#checkin').datepicker({
    minDate: FIRST_NIGHT,
    maxDate: LAST_NIGHT,
    defaultDate: new Date(2026, 10, 20),
    showButtonPanel: true,
    beforeShowDay: booked,
    onSelect: checkinChosen
  });

  $('#checkout').datepicker({
    minDate: new Date(2026, 10, 11),
    maxDate: new Date(2027, 10, 16),
    defaultDate: new Date(2026, 10, 22),
    showButtonPanel: true,
    beforeShowDay: booked,
    onSelect: updateNights
  });

  $('#dob').datepicker({
    changeMonth: true,
    changeYear: true,
    yearRange: '1930:2008',
    dateFormat: 'dd/mm/yy',
    defaultDate: new Date(1990, 0, 1),
    maxDate: new Date(2008, 11, 31)
  });

  // Picking a free date on the availability calendar fills in check-in.
  $('#availability').datepicker({
    minDate: FIRST_NIGHT,
    maxDate: LAST_NIGHT,
    defaultDate: new Date(2026, 10, 20),
    beforeShowDay: booked,
    onSelect: function (dateText) {
      $('#checkin').val(dateText);
      checkinChosen(dateText);
    }
  });

  $('#checkin, #checkout').on('change', updateNights);

  $('#booking').on('submit', function (e) {
    e.preventDefault();
    var inDate = parse('#checkin');
    var outDate = parse('#checkout');
    if (!inDate || !outDate) {
      $('#summary').text('Please choose check-in and check-out dates.').addClass('error');
      return;
    }
    var n = Math.round((outDate - inDate) / DAY);
    var who = $.trim($('#guest').val());
    $('#summary')
      .removeClass('error')
      .text('Booked ' + (n === 1 ? '1 night' : n + ' nights') + (who ? ' for ' + who : '') + ': ' + $('#checkin').val() + ' to ' + $('#checkout').val() + '.');
  });
});
