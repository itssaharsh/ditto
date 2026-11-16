# Lakeside Inn booking page: behaviour spec

The page lets a guest pick the nights of a stay and book a room. Its date fields use the jQuery UI 1.13 Datepicker; the
widget behaviour below follows that library's documentation (https://api.jqueryui.com/datepicker/, keyboard interaction
section). Dates are written mm/dd/yyyy unless stated otherwise. Bookings are open from 11/10/2026 to 11/15/2027, and the
nights of 11/24/2026, 11/25/2026 and 11/26/2026 are fully booked.

## 1. Choosing the stay

- Focusing the Check-in field opens a calendar under it. When the field is empty, the calendar shows November 2026 with
  the 20th highlighted as the suggested date.
- Clicking a day in the calendar puts that date in the field as mm/dd/yyyy (for example 11/20/2026) and closes the calendar.
- Days before 11/10/2026 cannot be chosen; they are shown greyed out and clicking them does nothing.
- The fully booked nights (11/24/2026 to 11/26/2026) are shown in red and cannot be chosen; hovering one shows
  "Fully booked".
- Focusing the Check-out field opens a calendar the same way. When it is empty it suggests 11/22/2026.
- Once a check-in date is chosen, check-out can only be at least one night later: the check-in day and every earlier day
  are greyed out in the check-out calendar.
- If a check-out date is already filled in and a new check-in date on or after it is chosen, the check-out date moves to
  the day after the new check-in (for example, with check-out 11/23/2026, choosing check-in 11/27/2026 changes check-out to
  11/28/2026) and the stay length shows "1 night".
- Under the dates, a line shows the length of the stay: "Choose your dates" until both dates are set, then "1 night" or
  "N nights" (for example "3 nights" for 11/20/2026 to 11/23/2026). It updates whenever either date changes.

## 2. Keyboard use while a calendar is open

From the jQuery UI documentation, while the Check-in, Check-out or Date of birth calendar is open:

- Page Up: show the previous month. Page Down: show the next month.
- Ctrl + Page Up: show the previous year. Ctrl + Page Down: show the next year.
- Ctrl + Home: open the calendar if it is closed, and go to the current month.
- Ctrl + Left / Ctrl + Right: move the highlighted day to the previous / next day.
- Ctrl + Up / Ctrl + Down: move the highlighted day to the previous / next week.
- Enter: choose the highlighted day (it fills the field and closes the calendar).
- Ctrl + End: close the calendar and erase the date in the field.
- Escape: close the calendar without choosing a day; the field keeps what it had.

## 3. The button panel (Check-in and Check-out)

- Below the check-in and check-out calendars there are two buttons, "Today" and "Done".
- "Today" moves the calendar to the current month. It does not choose a date and does not fill the field.
- "Done" closes the calendar without choosing a date.

## 4. Date of birth

- The Date of birth calendar has a month menu and a year menu in its header instead of a plain title.
- The year menu lists the years 1930 to 2008. When the field is empty, the calendar opens on January 1990.
- Choosing a day writes the date as dd/mm/yyyy (for example 15/03/1990).
- No date after 12/31/2008 can be chosen.

## 5. Availability calendar

- An "Availability" calendar is always shown beside the form, on November 2026, with the 20th highlighted.
- Fully booked nights are shown in red and cannot be chosen, as in the other calendars, and a legend explains the colour.
- Clicking a free day on the Availability calendar fills that date into Check-in, and the check-out rules and the stay
  length update as if it had been chosen in the Check-in calendar.

## 6. Booking

- The Book button checks the form. Without both dates it shows "Please choose check-in and check-out dates." in red.
- With both dates it shows, for example, "Booked 3 nights for Ada Lovelace: 11/20/2026 to 11/23/2026." The guest's name
  part ("for Ada Lovelace") is left out when the Full name field is empty, and one night is written "1 night".
- Booking does not leave the page or reload it.
