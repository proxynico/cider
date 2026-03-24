import EventKit
import Foundation

let store = EKEventStore()
let sem = DispatchSemaphore(value: 0)
store.requestFullAccessToEvents { _, _ in sem.signal() }
sem.wait()

let args = CommandLine.arguments
guard args.count >= 2 else {
  for c in store.calendars(for: .event) { print(c.title) }
  exit(0)
}

let isoF = ISO8601DateFormatter()
isoF.formatOptions = [.withFullDate]

guard args.count >= 3,
      let start = isoF.date(from: args[1]),
      let end = isoF.date(from: args[2]) else {
  fputs("Usage: cider-cal <start> <end> [calendar]\n", stderr)
  exit(1)
}

var calendars: [EKCalendar]? = nil
if args.count >= 4 {
  let name = args[3]
  calendars = store.calendars(for: .event).filter { $0.title == name }
  if calendars!.isEmpty { fputs("Calendar not found: \(name)\n", stderr); exit(1) }
}

let events = store.events(matching: store.predicateForEvents(withStart: start, end: end, calendars: calendars))
if events.isEmpty { print("No events found"); exit(0) }

let df = DateFormatter()
df.dateStyle = .medium
df.timeStyle = .short
for e in events {
  print("[\(e.calendar.title)] \(e.title ?? "(no title)") | \(df.string(from: e.startDate)) - \(df.string(from: e.endDate))")
}
