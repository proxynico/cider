import EventKit
import Foundation

let store = EKEventStore()
let sem = DispatchSemaphore(value: 0)
store.requestFullAccessToEvents { _, _ in sem.signal() }
sem.wait()

let args = Array(CommandLine.arguments.dropFirst())

if args.isEmpty {
  for c in store.calendars(for: .event) { print(c.title) }
  exit(0)
}

var startMs: Double?
var endMs: Double?
var calendarName: String?
var query: String?

var i = 0
while i < args.count {
  switch args[i] {
  case "--start-ms":
    guard i + 1 < args.count, let value = Double(args[i + 1]) else {
      fputs("Missing or invalid value for --start-ms\n", stderr)
      exit(1)
    }
    startMs = value
    i += 2
  case "--end-ms":
    guard i + 1 < args.count, let value = Double(args[i + 1]) else {
      fputs("Missing or invalid value for --end-ms\n", stderr)
      exit(1)
    }
    endMs = value
    i += 2
  case "--calendar":
    guard i + 1 < args.count else {
      fputs("Missing value for --calendar\n", stderr)
      exit(1)
    }
    calendarName = args[i + 1]
    i += 2
  case "--query":
    guard i + 1 < args.count else {
      fputs("Missing value for --query\n", stderr)
      exit(1)
    }
    query = args[i + 1]
    i += 2
  default:
    fputs("Usage: cider-cal [--start-ms <epoch-ms> --end-ms <epoch-ms> [--calendar <name>] [--query <text>]]\n", stderr)
    exit(1)
  }
}

guard let startMs, let endMs else {
  fputs("Usage: cider-cal [--start-ms <epoch-ms> --end-ms <epoch-ms> [--calendar <name>] [--query <text>]]\n", stderr)
  exit(1)
}

let start = Date(timeIntervalSince1970: startMs / 1000)
let end = Date(timeIntervalSince1970: endMs / 1000)

var calendars: [EKCalendar]? = nil
if let calendarName {
  calendars = store.calendars(for: .event).filter { $0.title == calendarName }
  if calendars!.isEmpty {
    fputs("Calendar not found: \(calendarName)\n", stderr)
    exit(1)
  }
}

let predicate = store.predicateForEvents(withStart: start, end: end, calendars: calendars)
var events = store.events(matching: predicate).sorted { $0.startDate < $1.startDate }

if let query, !query.isEmpty {
  events = events.filter { event in
    let haystacks = [event.title, event.location, event.notes].compactMap { $0?.localizedLowercase }
    return haystacks.contains { $0.contains(query.localizedLowercase) }
  }
}

if events.isEmpty {
  if let query, !query.isEmpty {
    print("No events matching: \(query)")
  } else {
    print("No events found")
  }
  exit(0)
}

let df = DateFormatter()
df.dateStyle = .medium
df.timeStyle = .short
for e in events {
  print("[\(e.calendar.title)] \(e.title ?? "(no title)") | \(df.string(from: e.startDate)) - \(df.string(from: e.endDate))")
}
