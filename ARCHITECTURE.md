# TimeFlow architecture

## Data flow

```text
Expo Router screen
  -> Zustand view state
  -> task/scheduler service
  -> pure scheduler functions
  -> SQLite repository/client
```

The root layout opens `timeflow.db`, applies ordered migrations, and loads the Inter and Poppins fonts before revealing routes. UI screens call services; the `src/scheduler` folder does not import React, Expo, or SQLite. Repository SQL uses bound parameters. Mutations involving multiple rows use SQLite transactions.

## Scheduling

`buildAvailability` creates date-bounded free slots from the active day range, repeating timetable activities, one-off fixed activities, skipped dates, locked sessions, and buffers. Unassigned free time is focus-capable. Travel windows carve out travel-only slots. `scoring` orders remaining tasks by priority, deadline urgency, age, then deterministic tie-breaks. `scheduleTasks` considers earliest eligible slots first, respects deadline times, caps focus/travel chunks, and returns explicit shortfalls for work that does not fit. Fixed-time daily tasks are reserved as locked sessions; completion is tracked in `task_occurrences`.

### Worked example

Assume Monday has a lecture from 10:00 to 12:00 and a travel window from 12:00 to 13:00. After subtracting the lecture and configured buffer, the remaining morning/afternoon gaps are focus-capable, while 12:00–13:00 is travel-only. A 180-minute focus task can use at most 120 minutes in a focus session; if a second eligible slot has 60 minutes, the plan becomes 120 + 60. A travel task may use the 12:00–13:00 interval, but a focus task cannot. If the task deadline ends before the next suitable interval, its unscheduled minutes are returned as a warning instead of being placed late.

## Persistence and completion

Task completion is centralized in `taskService.completeSession` and `taskService.completeTask`; Home, Calendar, Tasks, and task detail call the same actions. A session completion records actual/planned minutes, updates remaining time, preserves historical sessions, and rebuilds future sessions when needed. A five-second Undo action is available on those completion surfaces. Timetable changes also trigger a full rebuild while preserving locked and completed sessions, but do not yet provide an interactive change summary or Undo action.

Profile, theme preferences, timetable data, task data, schedule sessions, skipped dates, occurrence history, and schedule summaries are stored on device. Sensitive PIN material is kept in SecureStore and excluded from JSON backup files.
