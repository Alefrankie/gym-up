# Auth Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/workout-tracking.md](../../../prd/features/workout-tracking.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Purpose

Authentication and session management. User registration, login, logout, session persistence.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/auth/domain/`.

### `auth.types.ts`

```ts
// src/lib/contexts/auth/domain/auth.types.ts

export interface RegisterDTO {
  email: string;
  password: string;
  display_name: string;
  routine_type: 'hombre' | 'mujer';
  weight_unit: 'kg' | 'lbs';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SessionUser;
}

export interface SessionUser {
  id: string;
  email: string;
}

export interface AuthError {
  message: string;
  status: number;
}
```

### `auth.constants.ts`

```ts
// src/lib/contexts/auth/domain/auth.constants.ts

export const AuthEvents = {
  SignedIn: 'SIGNED_IN',
  SignedOut: 'SIGNED_OUT',
  TokenRefreshed: 'TOKEN_REFRESHED',
  UserUpdated: 'USER_UPDATED',
} as const;

export type AuthEvent = (typeof AuthEvents)[keyof typeof AuthEvents];

export const PasswordRules = {
  MinLength: 6,
  MaxLength: 128,
} as const;

export const DisplayNameRules = {
  MinLength: 1,
  MaxLength: 50,
} as const;
```

### Entities

- `User` — auth user managed by Supabase Auth. Has `id` (UUID), `email`, `created_at`.
- `Session` — access token + refresh token. Managed by Supabase client. Ephemeral.

### Invariants

- `email` MUST be valid email format.
- `password` MUST be minimum `PasswordRules.MinLength` (6) characters.
- `email` MUST be unique across all users. Supabase Auth enforces.
- Session MUST be valid (not expired) to access protected routes.
- One session per user at a time (Supabase default behavior).
- `display_name` MUST be non-empty string, max `DisplayNameRules.MaxLength` (50) characters.
- `routine_type` MUST be `'hombre'` or `'mujer'`.
- `weight_unit` MUST be `'kg'` or `'lbs'`.

### Ports

- `AuthPort` (interface) — signUp, signIn, signOut, getSession, onAuthStateChange.
- `SessionPort` (interface) — getToken, refreshToken, clearSession.

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| RegisterUserUseCase | Create auth user with email/password, store metadata (display_name, routine_type, weight_unit) | planned |
| LoginUserUseCase | Authenticate with email/password, establish session | planned |
| LogoutUserUseCase | Clear session, redirect to landing | planned |
| GetSessionUseCase | Retrieve current session, redirect if expired | planned |
| HandleAuthStateChangeUseCase | Listen for auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) | planned |

### Orchestration

1. `RegisterUserUseCase` calls `AuthPort.signUp()` → Supabase creates `auth.users` row → DB trigger creates `profiles` row → redirect to dashboard.
2. `LoginUserUseCase` calls `AuthPort.signIn()` → Supabase validates credentials → session established → redirect to dashboard.
3. `LogoutUserUseCase` calls `AuthPort.signOut()` → session cleared → redirect to landing.
4. `GetSessionUseCase` calls `AuthPort.getSession()` → if null, redirect to login.

---

## Infrastructure

Per [ADR-007](../decisions/007-repository-pattern.md), each port has an abstract class + two implementations. Per [ADR-011](../decisions/011-implements-not-extends.md), concrete classes use `implements`, not `extends`.

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/auth/domain/ports/auth-port.ts
abstract class AuthPort {
  abstract signUp(data: RegisterDTO): Promise<Session>;
  abstract signIn(data: LoginDTO): Promise<Session>;
  abstract signOut(): Promise<void>;
  abstract getSession(): Promise<Session | null>;
  abstract onAuthStateChange(callback: (event: string, session: Session | null) => void): void;
}

// src/lib/contexts/auth/domain/ports/session-port.ts
abstract class SessionPort {
  abstract getToken(): Promise<string | null>;
  abstract refreshToken(): Promise<string | null>;
  abstract clearSession(): Promise<void>;
}
```

### Supabase Implementation (Production)

```ts
// src/lib/contexts/auth/infrastructure/supabase/supabase-auth.adapter.ts
class SupabaseAuthAdapter implements AuthPort {
  constructor(private supabase: SupabaseClient) {}

  async signUp(data: RegisterDTO): Promise<Session> {
    const { data: result, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.display_name, routine_type: data.routine_type, weight_unit: data.weight_unit } }
    });
    if (error) throw new Error(error.message);
    return result.session;
  }

  async signIn(data: LoginDTO): Promise<Session> {
    const { data: result, error } = await this.supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    if (error) throw new Error(error.message);
    return result.session;
  }
  // ... other methods
}
```

### SQLite Implementation (Tests, E2E)

```ts
// src/lib/contexts/auth/infrastructure/sqlite/sqlite-auth.adapter.ts
class SqliteAuthAdapter implements AuthPort {
  constructor(private db: Database) {}

  async signUp(data: RegisterDTO): Promise<Session> {
    const id = crypto.randomUUID();
    // Insert into auth_users table
    this.db.prepare('INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)').run(id, data.email, hashPassword(data.password));
    // Create profile via trigger equivalent
    this.db.prepare('INSERT INTO profiles (id, display_name, routine_type, weight_unit) VALUES (?, ?, ?, ?)').run(id, data.display_name, data.routine_type, data.weight_unit);
    return { access_token: 'test-token', refresh_token: 'test-refresh', user: { id, email: data.email } };
  }
  // ... other methods
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/auth/auth.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { BrowserKeyValueStorage } from '@/lib/storage/BrowserKeyValueStorage';
import { SqliteKeyValueStorage } from '@/lib/storage/SqliteKeyValueStorage';
import { SupabaseAuthAdapter } from './infrastructure/supabase/SupabaseAuthAdapter';
import { SqliteAuthAdapter } from './infrastructure/sqlite/SqliteAuthAdapter';
import { SupabaseSessionAdapter } from './infrastructure/supabase/SupabaseSessionAdapter';
import { SqliteSessionAdapter } from './infrastructure/sqlite/SqliteSessionAdapter';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { LogoutUserUseCase } from './application/LogoutUserUseCase';

const authPort: AuthPort = useSupabase
  ? new SupabaseAuthAdapter(supabaseClient)
  : new SqliteAuthAdapter(sqliteDb);

const sessionPort: SessionPort = useSupabase
  ? new SupabaseSessionAdapter(supabaseClient)
  : new SqliteSessionAdapter(sqliteDb);

const kvStorage: KeyValueStorage = useSupabase
  ? new BrowserKeyValueStorage()
  : new SqliteKeyValueStorage(sqliteDb);

export const registerUserUseCase = new RegisterUserUseCase(authPort, kvStorage);
export const loginUserUseCase = new LoginUserUseCase(authPort, sessionPort, kvStorage);
export const logoutUserUseCase = new LogoutUserUseCase(authPort, sessionPort);
```

---

## UI

### Components

- `AuthForm` — registration and login form component.
  - Register fields: display_name, email, password, routine_type (select), weight_unit (select).
  - Login fields: email, password.
  - Client-side validation before submit.
  - Error display inline.

### Interactive components (Astro islands)

- `AuthForm.svelte` — Svelte island, form with client-side validation.

### Pages

- `/login` — static page with AuthForm (mode: login).
- `/register` — static page with AuthForm (mode: register).

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

`src/test/contexts/auth/RegisterUserUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqliteAuthAdapter } from '@/lib/contexts/auth/infrastructure/sqlite/SqliteAuthAdapter';
import { SqliteKeyValueStorage } from '@/lib/storage/SqliteKeyValueStorage';
import { RegisterUserUseCase } from '@/lib/contexts/auth/application/RegisterUserUseCase';

describe('RegisterUserUseCase', () => {
  it('creates user and stores session in KV', async () => {
    const db = createTestDb();
    const auth = new SqliteAuthAdapter(db);
    const kv = new SqliteKeyValueStorage(db);
    const useCase = new RegisterUserUseCase(auth, kv);

    const result = await useCase.execute({
      email: faker.internet.email(),
      password: 'password123',
      display_name: faker.person.fullName(),
      routine_type: 'hombre',
      weight_unit: 'kg',
    });

    expect(result.user.email).toBeDefined();
  });
});
```

---

## Flows

- [register.flow.md](./flows/register.flow.md)
- [login.flow.md](./flows/login.flow.md)
