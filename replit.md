# Mineral

A daily practice app for creatives reckoning with what they're called to make.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `EXPO_PUBLIC_FIREBASE_API_KEY` — Firebase API key (set in Replit Secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54 + React Native 0.81, expo-router (file-based), new architecture enabled
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Firebase Auth (email/password) — `lib/firebase.ts`
- Data: Firestore — users/{userId}, users/{userId}/fieldNotes/{noteId}, encounters/{encounterId}
- Storage: Firebase Storage (audio files)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Animations: React Native Reanimated (keep simple in v0.5)
- Local persistence: AsyncStorage

## Where things live

- `artifacts/mineral/` — the Expo mobile app
- `artifacts/mineral/app/` — expo-router screens
- `artifacts/mineral/app/(tabs)/` — four main tabs: index (today), notes, guide, origin
- `artifacts/mineral/constants/colors.ts` — Mineral design tokens (dark palette, phase accents)
- `artifacts/mineral/constants/typography.ts` — TypeScale and FontFamily constants
- `artifacts/mineral/constants/theme.ts` — Spacing, Phase types, FieldNoteType, etc.
- `artifacts/mineral/context/AuthContext.tsx` — Firebase Auth context (user, signIn, signUp, logOut)
- `artifacts/mineral/context/UserContext.tsx` — Firestore user profile context (cached via AsyncStorage)
- `artifacts/mineral/components/AtmosphereBackground.tsx` — dark gradient ground with Signal glow
- `artifacts/mineral/components/TabIcon.tsx` — custom geometric SVG tab icons
- `artifacts/mineral/lib/firebase.ts` — Firebase init (auth, db, storage singletons)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)

## Architecture decisions

- Firebase is used directly from the mobile client (Auth, Firestore, Storage) — no backend proxy for data.
- The Express API server (`artifacts/api-server`) is kept for any server-side operations that need a backend (e.g. admin tasks, future integrations). Firebase data is not routed through it.
- `userInterfaceStyle: "dark"` is forced in app.json — Mineral has no light mode.
- Phase I (Signal/Archaic) atmosphere only in v0.5; other phases implemented via same token system, just accent colors swap.
- Custom tab bar (classic Tabs, not NativeTabs) so we fully control the dark atmospheric styling. NativeTabs would override to system chrome.
- Firestore pattern rebuilds: perform pure, potentially expensive derivation outside transactions; use a short final transaction to validate exact input revisions and generation, then publish atomically. Never hold a transaction open through CPU-heavy pairwise work.

## Product

Four tabs at the bottom (lowercase): today / notes / guide / origin.

- **today**: The daily encounter flow — arrive → listen → reflect → integrate → close
- **notes**: Field note capture (Dream, Spark, Resistance, Symbol, Synchronicity, Vision chips + recent feed)
- **guide**: Chronological feed of all field notes (no lenses in v0.5)
- **origin**: Minimal spiral, user's current position, birth-anchored

Six-screen onboarding (Hello, The Spiral, Signature, The Practice, Begin, Reflect) — coming next.

## User preferences

- Do not add features not explicitly asked for.
- Do not suggest design system improvements without asking.
- Do not introduce libraries beyond those listed in the tech stack.
- Do not generate placeholder content — use real encounter content or clear empty states.
- Do not invent product names, taglines, or copy.
- Build foundation first, then screens one by one as guided.
- Language rules: "reflect" (verb), "field note" (noun). Never "journal," "entry," "log." Daily content = "encounter." Steps = arrive, listen, reflect, integrate.

## Gotchas

- Firebase is initialized as a singleton in `lib/firebase.ts` — do not re-initialize.
- `getFirebaseAuthSingleton()` handles iOS/Android persistence via AsyncStorage vs web getAuth.
- `userInterfaceStyle: "dark"` means never test with system light mode — the design only exists in dark.
- Tab icons are custom SVGs (TabIcon.tsx), not @expo/vector-icons — they implement the four Mineral geometric primitives exactly.
- Tabs hide during the encounter flow (between Begin and Close) — implement this when building the encounter.
- No day counts visible — phase position is the indicator (e.g., "in signal · first turn of the spiral").

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Firebase security rules must be written properly from v0.5: users/{userId} read/write only if auth.uid == userId; encounters read-only for auth users.
