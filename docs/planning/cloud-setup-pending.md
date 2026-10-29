# Cloud setup pending

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

Everything in the app is implemented. These steps need the owner's Cloudflare, Google or Android accounts, so they are done by hand. Until then the app works with the limits listed in the last column.

| # | Step | Needed for | Until it is done |
|---|------|-----------|------------------|
| 1 | Enable R2 on the Cloudflare account (dashboard, R2; may ask for a payment method), then create the bucket and bind it | Private progress photos (and meal photos) | Photo endpoints answer 503 and the Photos screen says "todavía no están activadas". Meals are saved without their photo. |
| 2 | Create a Gemini API key and store it as a Worker secret | Meal analysis from a photo | `/nutrition/analyze` answers 503; the app offers "Agregar a mano". |
| 3 | Add the Rate Limiting binding for login | Brute-force protection on login and register (ADR-027 section 7) | The code is ready and skipped when the binding is absent: login is not rate limited. |
| 4 | Release signing: create an Android keystore and a Play Console account (internal testing track) | A signed release bundle (AAB) | Only debug APKs can be installed (`pnpm --filter @gym-up/app android:debug`). |
| 5 | Optional: rename the `workers.dev` subdomain or attach a custom domain | Nicer URLs | URLs end in `gymup-phase0-spike.workers.dev` (the subdomain was registered during the Phase 0 spike). |
| 6 | Delete the test D1 database `gymup-phase0` | Tidiness | It sits unused in the account. The real database is `gym-up`. |
| 7 | Optional: secure token storage in the Android app (ADR-027 open question 3) | Keeping the session token out of `localStorage` | The token lives in the WebView's `localStorage`. |

## Commands

1. **R2.** After enabling R2 in the dashboard:

   ```sh
   cd apps/api
   npx wrangler r2 bucket create gym-up-photos
   ```

   Then add the binding to `apps/api/wrangler.jsonc` (the same block already exists in `wrangler.local.jsonc`) and deploy:

   ```jsonc
   "r2_buckets": [{ "binding": "PHOTOS", "bucket_name": "gym-up-photos" }]
   ```

   ```sh
   pnpm --filter @gym-up/api deploy
   ```

2. **Gemini.** Create the key in Google AI Studio, then:

   ```sh
   cd apps/api
   npx wrangler secret put GEMINI_API_KEY
   ```

3. **Rate limiting.** Add to `apps/api/wrangler.jsonc` and redeploy. The binding name must stay `LOGIN_LIMITER`:

   ```jsonc
   "ratelimits": [{ "name": "LOGIN_LIMITER", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } }]
   ```

4. **Android release.** With a keystore, configure signing in `apps/app/src-tauri/gen/android/app/build.gradle.kts` and run `pnpm tauri android build --apk` or `--aab`. Keep the keystore and its passwords out of the repository.

5. **Delete the spike database.**

   ```sh
   npx wrangler d1 delete gymup-phase0
   ```

## Already in the cloud

| Resource | Name |
|----------|------|
| Worker (API) | `gym-up-api` |
| Worker (web, static assets) | `gym-up-web` |
| D1 database | `gym-up` (5 migrations and the reference seed applied) |
