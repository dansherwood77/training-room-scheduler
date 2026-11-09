# Notes

## Time

About 2 hours total, on Sunday, November 8, 2026. Most of that time was thinking through use cases and design features. Writing the shared rules, the API, the interface, and checking it in the browser was the smaller part.

Use cases:

- A room can run sessions back to back, but two sessions in the same room cannot overlap, including one that runs past midnight.
- Choosing a room should leave the rest of the day visible, so you can see when that room is actually free.
- A short block only has room for the title. The room name and the instructor show up once the card is tall enough.
- Canceling a booking or a room asks first, and the sentence names what will be removed.

Design features:

- Paper and sun yellow, with yellow as a fill behind dark type, never as the type itself.
- Arrows sit on the date. Today only returns after you leave the current day, week, or month.
- Switching day, week, and month fades the calendar. The session cards stay where the new view puts them.
- A new room offers rainbow colors that are not already used on the board.

## Challenges

- A full day is taller than the screen if each hour is large enough to read. Fitting the day to the viewport keeps a drag continuous, so pulling past the bottom of a column can run into the next morning. The sheet is still where the exact times get set.
- Days are not always 24 hours long. The spring-forward Sunday in Los Angeles drops an hour, so the grid maps each column across that day's real start and end instead of a fixed 86,400,000 milliseconds.
- Shared layout animation wants one element per booking. A session that crosses midnight is drawn once per day, and only the first piece carries the layout id into the month.
- Yellow reads as sunlight only when the type on it stays dark. The sun color is a fill. Titles, times, and refusal sentences stay in ink or clay.
- `better-sqlite3` is a native module. The API keeps it in the Express process so Next does not have to bundle it. The overlap check itself is a few lines of SQL with half-open ranges, which is the part worth reading aloud.
- Choosing a room used to remove every other session. What you want to see is what else is happening while that room is free, so the other blocks stay on the grid and fade to paper.
- A card is only as tall as the session. The title wraps, two lines at most. The room name and the instructor wait until the block is tall enough to hold them.
- The date and the last/next row were the same control. The arrows sit on the date, and Today only comes back once you have left.
- Day, week, and month each used to ask for their own range. A slow answer could replace the view you had already opened. One month is loaded, the view slices it, and a late response is dropped.
