import EventKit
import Foundation

struct Options {
  var mode = "search"
  var startMs: Double?
  var endMs: Double?
  var calendarName: String?
  var query: String?
  var title: String?
  var newTitle: String?
  var location: String?
  var notes: String?
}

func usage() -> Never {
  fputs("""
Usage:
  cider-cal
  cider-cal --doctor
  cider-cal --start-ms <epoch-ms> --end-ms <epoch-ms> [--calendar <name>] [--query <text>]
  cider-cal --create-event --title <title> --start-ms <epoch-ms> --end-ms <epoch-ms> [--calendar <name>] [--location <text>] [--notes <text>]
  cider-cal --update-event --title <title> --calendar <name> [--new-title <title>] [--start-ms <epoch-ms>] [--end-ms <epoch-ms>] [--location <text>] [--notes <text>]
  cider-cal --delete-event --title <title> --calendar <name>

""", stderr)
  exit(1)
}

func requireValue(_ args: [String], _ index: Int, _ flag: String) -> String {
  guard index + 1 < args.count else {
    fputs("Missing value for \(flag)\n", stderr)
    exit(1)
  }
  return args[index + 1]
}

func parseOptions(_ args: [String]) -> Options? {
  if args == ["--doctor"] {
    print("cider-cal ok")
    print("calendar authorization: \(calendarAuthorizationStatus())")
    exit(0)
  }

  var options = Options()
  var i = 0
  while i < args.count {
    switch args[i] {
    case "--create-event":
      options.mode = "create"
      i += 1
    case "--update-event":
      options.mode = "update"
      i += 1
    case "--delete-event":
      options.mode = "delete"
      i += 1
    case "--start-ms":
      let raw = requireValue(args, i, "--start-ms")
      guard let value = Double(raw) else {
        fputs("Missing or invalid value for --start-ms\n", stderr)
        exit(1)
      }
      options.startMs = value
      i += 2
    case "--end-ms":
      let raw = requireValue(args, i, "--end-ms")
      guard let value = Double(raw) else {
        fputs("Missing or invalid value for --end-ms\n", stderr)
        exit(1)
      }
      options.endMs = value
      i += 2
    case "--calendar":
      options.calendarName = requireValue(args, i, "--calendar")
      i += 2
    case "--query":
      options.query = requireValue(args, i, "--query")
      i += 2
    case "--title":
      options.title = requireValue(args, i, "--title")
      i += 2
    case "--new-title":
      options.newTitle = requireValue(args, i, "--new-title")
      i += 2
    case "--location":
      options.location = requireValue(args, i, "--location")
      i += 2
    case "--notes":
      options.notes = requireValue(args, i, "--notes")
      i += 2
    default:
      usage()
    }
  }
  return options
}

func calendarAuthorizationStatus() -> String {
  let status = EKEventStore.authorizationStatus(for: .event)
  switch status {
  case .authorized:
    return "authorized"
  case .denied:
    return "denied"
  case .notDetermined:
    return "notDetermined"
  case .restricted:
    return "restricted"
  case .fullAccess:
    return "fullAccess"
  case .writeOnly:
    return "writeOnly"
  @unknown default:
    return "unknown"
  }
}

func requestCalendarAccess(_ store: EKEventStore) {
  let sem = DispatchSemaphore(value: 0)
  var granted = false
  var accessError: Error?

  if #available(macOS 14.0, *) {
    store.requestFullAccessToEvents { ok, err in
      granted = ok
      accessError = err
      sem.signal()
    }
  } else {
    store.requestAccess(to: .event) { ok, err in
      granted = ok
      accessError = err
      sem.signal()
    }
  }

  sem.wait()
  if !granted {
    let detail = accessError.map { ": \($0.localizedDescription)" } ?? ""
    fputs("Calendar permission denied\(detail). Grant calendar access in System Settings > Privacy & Security > Calendars.\n", stderr)
    exit(1)
  }
}

func dateFromMs(_ value: Double) -> Date {
  Date(timeIntervalSince1970: value / 1000)
}

func calendars(matching name: String?, in store: EKEventStore) -> [EKCalendar]? {
  guard let name else { return nil }
  let matches = store.calendars(for: .event).filter { $0.title == name }
  if matches.isEmpty {
    fputs("Calendar not found: \(name)\n", stderr)
    exit(1)
  }
  return matches
}

func requiredCalendar(named name: String?, in store: EKEventStore) -> EKCalendar {
  guard let name else {
    guard let calendar = store.defaultCalendarForNewEvents else {
      fputs("Default calendar not found\n", stderr)
      exit(1)
    }
    return calendar
  }

  let matches = store.calendars(for: .event).filter { $0.title == name }
  if matches.isEmpty {
    fputs("Calendar not found: \(name)\n", stderr)
    exit(1)
  }
  if matches.count > 1 {
    fputs("Multiple calendars match: \(name)\n", stderr)
    exit(1)
  }
  return matches[0]
}

func eventsByExactTitle(_ title: String, calendar: EKCalendar, store: EKEventStore) -> [EKEvent] {
  return eventsByExactTitle(title, calendars: [calendar], store: store)
}

func eventsByExactTitle(_ title: String, calendarName: String?, store: EKEventStore) -> [EKEvent] {
  if let calendarName {
    let calendar = requiredCalendar(named: calendarName, in: store)
    return eventsByExactTitle(title, calendar: calendar, store: store)
  }

  return eventsByExactTitle(title, calendars: nil, store: store)
}

func eventsByExactTitle(_ title: String, calendars: [EKCalendar]?, store: EKEventStore) -> [EKEvent] {
  let calendar = Calendar.current
  var matches: [EKEvent] = []
  var seen = Set<String>()
  var cursor = calendar.date(from: DateComponents(year: 1970, month: 1, day: 1))!
  let end = calendar.date(from: DateComponents(year: 2100, month: 1, day: 1))!

  while cursor < end {
    let next = min(calendar.date(byAdding: .year, value: 3, to: cursor)!, end)
    let predicate = store.predicateForEvents(withStart: cursor, end: next, calendars: calendars)
    for event in store.events(matching: predicate) where event.title == title {
      let key = event.eventIdentifier ?? "\(event.calendar.calendarIdentifier)-\(event.startDate.timeIntervalSince1970)-\(event.title ?? "")"
      if !seen.contains(key) {
        seen.insert(key)
        matches.append(event)
      }
    }
    cursor = next
  }

  return matches
}

func requireSingleEvent(title: String?, calendarName: String?, store: EKEventStore) -> EKEvent {
  guard let title else {
    fputs("Missing --title\n", stderr)
    exit(1)
  }
  let matches = eventsByExactTitle(title, calendarName: calendarName, store: store)
  if matches.isEmpty {
    fputs("Event not found: \(title)\n", stderr)
    exit(1)
  }
  if matches.count > 1 {
    fputs("Multiple events match: \(title)\n", stderr)
    exit(1)
  }
  return matches[0]
}

func save(_ event: EKEvent, in store: EKEventStore) {
  do {
    try store.save(event, span: .thisEvent, commit: true)
  } catch {
    fputs("Calendar save failed: \(error.localizedDescription)\n", stderr)
    exit(1)
  }
}

func remove(_ event: EKEvent, in store: EKEventStore) {
  do {
    try store.remove(event, span: .thisEvent, commit: true)
  } catch {
    fputs("Calendar delete failed: \(error.localizedDescription)\n", stderr)
    exit(1)
  }
}

let args = Array(CommandLine.arguments.dropFirst())
guard let options = parseOptions(args) else { usage() }

let store = EKEventStore()
requestCalendarAccess(store)

if args.isEmpty {
  for c in store.calendars(for: .event) { print(c.title) }
  exit(0)
}

switch options.mode {
case "search":
  guard let startMs = options.startMs, let endMs = options.endMs else { usage() }
  let start = dateFromMs(startMs)
  let end = dateFromMs(endMs)
  let predicate = store.predicateForEvents(withStart: start, end: end, calendars: calendars(matching: options.calendarName, in: store))
  var events = store.events(matching: predicate).sorted { $0.startDate < $1.startDate }

  if let query = options.query, !query.isEmpty {
    let needle = query.localizedLowercase
    events = events.filter { event in
      let haystacks = [event.title, event.location, event.notes].compactMap { $0?.localizedLowercase }
      return haystacks.contains { $0.contains(needle) }
    }
  }

  if events.isEmpty {
    if let query = options.query, !query.isEmpty {
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

case "create":
  guard let title = options.title, let startMs = options.startMs, let endMs = options.endMs else { usage() }
  let event = EKEvent(eventStore: store)
  event.title = title
  event.startDate = dateFromMs(startMs)
  event.endDate = dateFromMs(endMs)
  event.calendar = requiredCalendar(named: options.calendarName, in: store)
  if let location = options.location { event.location = location }
  if let notes = options.notes { event.notes = notes }
  save(event, in: store)
  print("Event created: \(title)")

case "update":
  let event = requireSingleEvent(title: options.title, calendarName: options.calendarName, store: store)
  var didUpdate = false
  if let newTitle = options.newTitle {
    event.title = newTitle
    didUpdate = true
  }
  if let startMs = options.startMs {
    event.startDate = dateFromMs(startMs)
    didUpdate = true
  }
  if let endMs = options.endMs {
    event.endDate = dateFromMs(endMs)
    didUpdate = true
  }
  if let location = options.location {
    event.location = location
    didUpdate = true
  }
  if let notes = options.notes {
    event.notes = notes
    didUpdate = true
  }
  if !didUpdate {
    fputs("No updates specified\n", stderr)
    exit(1)
  }
  save(event, in: store)
  print("Event updated: \(options.title!)")

case "delete":
  let event = requireSingleEvent(title: options.title, calendarName: options.calendarName, store: store)
  remove(event, in: store)
  print("Event deleted: \(options.title!)")

default:
  usage()
}
