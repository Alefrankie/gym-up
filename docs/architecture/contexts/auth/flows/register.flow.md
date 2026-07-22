# Register Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - User Opens Registration

User visits `/register` or clicks "Create account" on landing. AuthForm renders with fields: display_name, email, password, routine_type (radio: hombre/mujer), weight_unit (radio: kg/lbs).

### Step 2 - Client-Side Validation

Client validates:
- Email format (regex)
- Password ≥ 6 characters
- display_name non-empty
- routine_type selected
- weight_unit selected

If invalid: show inline error per field. Stop.

### Step 3 - Supabase signUp

Client calls `supabase.auth.signUp({ email, password, options: { data: { display_name, routine_type, weight_unit } } })`.

### Step 4 - Profile Auto-Created

Supabase creates `auth.users` row. DB trigger `handle_new_user()` fires, inserts `profiles` row with `id = NEW.id`, `display_name`, `routine_type`, `weight_unit` from metadata.

### Step 5 - Redirect

On success: redirect to `/dashboard`.
On error: show error message (e.g., "Email already registered").

---

## Failure: Email Already Exists

Step 3 returns error `400 User already registered`. Show "Email already registered. Login?" with link to `/login`.

## Failure: Weak Password

Step 3 returns error if password too weak. Show "Password must be at least 6 characters".
