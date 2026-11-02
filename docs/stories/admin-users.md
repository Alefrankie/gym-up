# Admin: registered users

## User story

As an admin, I want to see registered users, their registration date, and their last-access date.

## Acceptance criteria

1. Only an authenticated admin can open the registered-users screen or read its API endpoint. Other authenticated users receive a forbidden response; signed-out users follow the existing authentication flow.
2. The screen is linked from **More** for admins and displays each listed user's name, email, registration date, and last-access date.
3. "Last access" means the latest authenticated app request. It is not an online/presence indicator. To limit D1 writes, the server updates this timestamp at most once every five minutes per user.
4. The list includes admin accounts and identifies them as admins. Search matches name and email; pagination returns a total count and stable ordering.
5. The response uses an admin-specific contract and never includes password hashes or unrelated private profile fields. The existing user DTO and voice-studio user search remain unchanged.
6. The screen has loading, error, empty, and no-search-results states. Text is available in Spanish and English, and dates follow the app's selected locale.
7. A missing historical access date is presented as "Sin dato disponible" / "No data available"; it must not imply that the person has never used the app.

## Data behavior and limitation

- `profiles.created_at` already stores registration time as a SQLite Unix timestamp in seconds.
- Add nullable `profiles.last_access_at`, using the same timestamp unit as `profiles.created_at`. Record authenticated requests on the existing AuthGuard path, throttled per user; a failed timestamp write must not fail authentication.
- The migration may backfill from the newest session row that still exists. Logout deletes session rows, so some existing accounts cannot be backfilled and remain without a known date until their next authenticated app request.

## Out of scope

- Online/offline presence, activity heartbeats, and unthrottled per-request writes.
- Changing who has admin rights.
- Changing the shared user DTO or the existing voice-studio search endpoint.



