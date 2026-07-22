# Login Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - User Opens Login

User visits `/login` or clicks "Already have account" on landing. AuthForm renders with fields: email, password.

### Step 2 - Client-Side Validation

Client validates:
- Email format
- Password non-empty

If invalid: show inline error. Stop.

### Step 3 - Supabase signInWithPassword

Client calls `supabase.auth.signInWithPassword({ email, password })`.

### Step 4 - Session Established

Supabase returns session with access_token, refresh_token. Client stores session.

### Step 5 - Redirect

On success: redirect to `/dashboard`.
On error: show error message.

---

## Failure: Invalid Credentials

Step 3 returns error `400 Invalid login credentials`. Show "Invalid email or password".

## Failure: Email Not Confirmed

If email confirmation enabled (not in our case), step 3 returns error. Show "Please confirm your email".
