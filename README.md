# TimeFlow

TimeFlow is an offline-first Expo and React Native time manager. User data is kept in a local SQLite database; no account, network service, or analytics are required.

## Requirements

- Node.js LTS and npm
- Expo Go on a device for basic UI development
- Android Studio or an iOS device for native testing (iOS native builds require macOS)

## Install and run

```powershell
npm install
npx expo start
```

Use the QR code with Expo Go, or press `a` to open an Android emulator. On Windows, use an Android emulator or Expo Go; local iOS builds require macOS.

Useful checks:

```powershell
npx tsc --noEmit
npm test
npx expo-doctor
npx expo install --check
```

## Project layout

- `app/` contains Expo Router routes, onboarding, the five tabs, task forms, and settings.
- `src/scheduler/` is pure TypeScript scheduling logic and its unit tests.
- `src/services/` coordinates scheduling, database persistence, task completion, and notifications.
- `src/db/` contains SQLite initialization, schema migrations, and typed repositories.
- `src/theme/` defines palettes, design tokens, and the persisted theme provider.
- `components/ui/` contains reusable themed UI components.

The root screen opens SQLite and applies migrations before rendering. The first launch runs onboarding; following launches go directly to Home unless App Lock is enabled.

## Data and scheduling

Weekly activities and time windows use Monday-based weekday numbers (`0` to `6`) and minutes from midnight. Concrete sessions are stored as local date/time strings. The scheduler plans inside a configurable horizon, subtracts fixed activities and buffers, puts travel tasks only in explicit travel windows, splits focus work into sessions, orders work by priority and deadline, and reports shortfalls rather than scheduling after a deadline. The same completion service is used by Home, Calendar, and task detail.

The Calendar view combines recurring commitments, dated fixed activities, task sessions, and the remaining time in the 06:00–23:00 planning window, with daily and weekly views. Weekly and date-specific free-time preferences are stored separately from commitments and are shown only in the portions that remain available. The Analytics tab summarizes explicit session completion, task categories, travel-task time, saved commitments, and remaining time by day, week, or month. These summaries are estimates from local schedule records; the app does not record passive time use.

When reminders are enabled, scheduled notifications include upcoming task sessions, dated fixed activities, and recurring weekly timetable activities. Reminder updates cancel and replace prior scheduled notifications when the schedule changes. Lecture activities can have linked preparation and revision sessions with user-selected dates, start times, durations, activities, notes, and per-session reminders. These are saved as pinned task sessions in the unified timetable; fixed-activity conflicts are rejected and nearby available times are suggested.

Optional animated character styles are available during onboarding and in Appearance settings. Boy and girl style collections each include five lightweight animated previews; the selected companion appears on Home, the Home tab, loading and empty states. Animations respect the device's reduced-motion preference, and the selection is stored with the local theme settings.

Scheduling writes are persisted transactionally. Completed and locked sessions are preserved. Daily recurring tasks reserve their fixed daily time and create a separate occurrence record when completed.

## Local privacy

All application data lives on device in SQLite. PIN credentials use a random salt and SHA-256 digest stored in SecureStore; notification and biometric functionality is optional. JSON backups can be exported or imported from Settings, including saved free-time preferences. PIN/biometric credentials are not included in backups.

## Native capabilities

Expo Go is suitable for the core screens and local SQLite workflows. Notifications, biometrics, secure storage, image selection, and platform permissions should be tested on physical devices or a development build. To create a development build:

```powershell
npx expo run:android
```

For EAS:

```powershell
npm install --global eas-cli
eas login
eas build:configure
eas build --platform android
eas build --platform ios
```

iOS EAS builds require an Apple Developer account. Review app identifiers, permission descriptions, icons, and store policies before release.

## Troubleshooting

- **Metro cache / stale bundle:** `npx expo start -c`
- **SQLite worker error during web development:** the SDK 57.0.13 Metro serializer can fail on lazy development worker graphs. The `patches/` fix skips generating a worker chunk for lazy development bundles, allowing Metro to serve the worker from its worker URL. `patch-package` reapplies the fix after dependency installation. Restart Expo after installing dependencies; `npx expo start --web --clear` clears stale bundle cache.
- **Expo SDK dependency mismatch:** `npx expo install --fix`, then `npx expo-doctor`
- **Expo Go module limitations:** use a development build (`npx expo run:android` or EAS) for native capabilities that Expo Go does not expose.
- **Reanimated/worklets errors:** keep the SDK-matched packages installed with `npx expo install react-native-reanimated react-native-worklets`, clear Metro cache, then restart.
- **SQLite migration failure:** preserve a backup first. During development, clear the app's local data or reinstall the app to recreate the database. The SQLite Inspector in Expo DevTools can inspect the local database.
- **Date/time-zone discrepancies:** sessions use local wall-clock date/time values. Compare the device zone and manually verify times after changing its time zone or daylight-saving offset.
- **Biometric prompt unavailable:** enroll Face ID/fingerprint in the device or emulator settings, grant OS permission, and test in a development build.
- **Image picker permission denied:** grant Photos access in OS Settings; the app remains usable without an avatar.
- **Android back behavior on lock screen:** the lock route remains the active route until successful PIN or biometric authentication.
- **Reminder notifications:** enable reminders in Settings and grant notification permission. Android/iOS notification restrictions differ; use a development build for reliable native testing.

## Current capability notes

The scheduler is deterministic for a fixed input and validates overlaps. Bumping is implemented by rebuilding all movable future work in priority order; there is no interactive cascade preview or universal Undo sheet for timetable-triggered rebuilds yet. Cross-midnight events can be represented in the database, but the timetable editor currently accepts same-day `HH:mm` times. Validate critical deadlines and recurrence placement against your own schedule before relying on it.

There is no AI backend configured, so the app does not send personal schedule data to an external assistant. Biometric unlock uses the device authentication prompt and has not been validated on a physical device in this workspace.
