# Games Hub — Project Brief

## games.canberratimes.com.au

> A new vertical for The Canberra Times, scaling across all 60 ACM mastheads in regional Australia.

---

## 1. Product vision

Build a daily games platform that drives subscriber acquisition (top of funnel) and retention (reduce churn) for Canberra Times and the broader ACM network. Games are regionally focused, content-driven (not code-driven), and powered by AI agents + editorial moderation.

### Key metrics to prove success

- **Subscribers who engage with both news AND games weekly** have the highest retention rate (proven by NYT)
- Daily active players, 7-day and 30-day consecutive play rates
- Share rate (% of completions shared)
- Free → premium conversion from games
- Games hub as % of total site traffic

---

## 2. Business context

### ACM / NewsNow platform

The games platform integrates with ACM's existing NewsNow infrastructure:

| Service | Role | Games integration |
|---------|------|-------------------|
| **Monza** | ACM staff SSO (internal only) | NOT used by games PWA for readers. Only relevant if editors use Monza SSO to log into the Games CMS |
| **Phoenix** | Reader sign-up flow only | Bridges first-party login to Piano's ID system. Used only during registration |
| **Piano** | Reader identity + sessions + entitlements + billing | **Primary reader auth for games.** Check session cookie on load, verify entitlement, gate premium games |
| **Silverstone** | Story management | Archive content source for trivia, "On This Day", timeline puzzles. AI agents query via API |
| **Valencia** | Digital asset management | Archive photos for visual games (Flashback Friday, Photo Mystery). Transform handles resizing |
| **Transform** | Image processing | Resize archive images for game tiles (blur/reveal steps, responsive sizes, sepia variants) |
| **Sochi** | Outbound proxy | Routes AI agent calls (Claude API) through existing external proxy. Same pattern as weather/AI in NewsNow |
| **Dijon** | Subscription list management | Join games engagement data with subscriber churn/retention data for business case |
| **Suzuka** | Site building / feeds | Embed games widget on main canberratimes.com.au homepage. Pulls from games API endpoint |
| **Monaco** | Front-end renderer | Renders the homepage games strip pulled by Suzuka |

### Reader auth flow

```
Page load → check Piano session cookie on .canberratimes.com.au
  ├── No cookie → Anonymous (device ID only, play free games)
  ├── Cookie found → Piano.getUser() → Piano.checkEntitlement()
  │     ├── Basic tier → logged in, streak sync, leaderboard, but premium games locked
  │     └── Premium tier → all games unlocked
  └── New registration → Phoenix sign-up flow → Piano ID created → return to games
```

### Three reader tiers

| Feature | Anonymous | Piano registered (basic) | Piano premium |
|---------|-----------|--------------------------|---------------|
| Free daily game | Yes | Yes | Yes |
| Local streak (device only) | Yes | Yes | Yes |
| Share results | Yes | Yes | Yes |
| Cloud-synced streak | No | Yes | Yes |
| Leaderboard | No | Yes | Yes |
| "How Canberra played" stats | No | Yes | Yes |
| Premium games | No | No | Yes |
| Archive photo games | No | No | Yes |
| Hints (5/day vs 3/day) | 3/day | 3/day | 5/day |

---

## 3. Design system — match Explore Travel vertical

The Games Hub must use the **same design language as Explore Travel** (canberratimes.com.au/travel).

### Figma source files

- **Explore Travel Hub**: `https://www.figma.com/design/ScTqvT152OvNnfdf9sPuCx/Explore-Travel?node-id=9037-29214`
- **Hub prototype**: `https://www.figma.com/proto/ScTqvT152OvNnfdf9sPuCx/Explore-Travel?node-id=9021-21112`
- **Article page**: `https://www.figma.com/proto/ScTqvT152OvNnfdf9sPuCx/Explore-Travel?node-id=9021-24574`
- **Save list**: `https://www.figma.com/proto/ScTqvT152OvNnfdf9sPuCx/Explore-Travel?node-id=10157-5640`

### Design tokens (from Figma variables)

```css
/* Colors — Tailwind gray scale */
--gray-50: #F9FAFB;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;   /* Category labels, secondary text */
--gray-600: #4B5563;   /* Body text */
--gray-800: #1F2937;
--gray-900: #111827;   /* Primary text, headings */
--white: #FFFFFF;
--red-600: #DC2626;
--yellow-100: #FEF3C7;
--yellow-800: #92400E;
--ct-blue: #00558C;    /* Canberra Times brand */

/* Radius */
--radius-regular: 8px;
--radius-small: 4px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-base: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.1);
```

### Typography

| Element | Font | Weight | Size | Line height |
|---------|------|--------|------|-------------|
| Headlines (cards) | Playfair Display | Medium (500) | 20px | normal |
| Hero headlines | Playfair Display | Medium (500) | 32px+ | normal |
| Body text | Inter | Regular (400) | 16px | 24px |
| Category labels | Inter | Medium (500) | 12px | 16px (uppercase) |
| Navigation | Inter | Regular (400) | 14px | 12px |
| Bylines | Inter | Medium (500) | 12px | 1.5 (capitalize) |
| UI buttons | Inter | Semi Bold (600) | 14px | 20px (uppercase, wider tracking) |

### Navigation pattern

Two-row header matching Explore Travel:

- **Row 1 (CT masthead)**: Hamburger + Search (left) | CT Logo centered | User account (right)
- **Row 2 (Vertical nav)**: "games" wordmark (replaces "explore") + horizontal nav items
- **Sticky behaviour**: On scroll, row 1 collapses, row 2 becomes sticky

Games Hub nav items:

```
games | Daily Challenge | Map Games | Crossword | Flashback | Leaderboard | Archive
```

### Card patterns

Article cards from Explore Travel → adapted as **Game cards**:

- Rounded 8px image on top (game thumbnail/screenshot)
- Category tag (uppercase Inter Medium 12px, gray-500)
- Playfair Display headline (game name)
- Inter body excerpt (game description / today's challenge)
- Inter Medium byline (streak info / player count)

---

## 4. Tech stack

### Framework & frontend

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Next.js 15 (App Router)** | SSR for hub shell, client components for games, ISR for daily content, API routes for validation |
| UI | **React 19 + Tailwind CSS 4** | Matches Explore Travel's styling approach. Shared game shell components |
| Maps | **MapLibre GL JS** | Replaces Leaflet. WebGL-rendered, vector tiles, better performance for 3 map-based games |
| State | **idb-keyval** (IndexedDB wrapper, 600 bytes) | Streaks, progress, preferences, offline event queue |
| PWA | **Workbox 7 + next-pwa** | Service worker for offline play, push notifications, cache strategies |
| Analytics | **PostHog** (self-hosted or cloud) | Event pipeline, cohort analysis, feature flags, session replay |
| Auth | **Piano SDK** | Session check, entitlement verification, checkout flow |
| Push | **Firebase Cloud Messaging (FCM)** | Daily puzzle notifications via Web Push API |
| Confetti | **canvas-confetti** (6KB) | Already used in prototypes |

### CMS & content pipeline

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Games CMS | **Sanity.io** (hosted) or **Strapi 5** (self-hosted) | Structured content schemas, editorial workflow, webhook on publish |
| AI agents | **Cloud Functions** + **Claude API via Sochi** | Scheduled generation, structured JSON output, validation |
| Image pipeline | **Valencia + Transform** (existing ACM) | Archive photos, responsive sizes, game-specific crops |

### Hosting & infrastructure

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Hosting | **Vercel** (Pro tier) | Zero-config Next.js, edge functions, ISR, preview deploys. Cheapest path for experiment (~$40/mo for 2 devs) |
| Edge API | **Cloudflare Workers + KV/D1** | Player state, leaderboards, score submission at the edge |
| CDN | **Cloudflare** (free tier) | Game JSON cached globally. TTL = until next daily publish |
| Subdomain | `games.canberratimes.com.au` | Shares `.canberratimes.com.au` cookie domain for Piano session |
| Monitoring | **Sentry** (free tier) | Browser error tracking, performance monitoring, session replay, alerting |

#### Hosting cost estimate (experiment phase)

| Service | Monthly cost |
|---------|-------------|
| Vercel Pro | ~$40 (2 devs) |
| Cloudflare (free tier) | $0 |
| Sanity.io (free tier, 3 users) | $0 |
| PostHog (free tier, 1M events/mo) | $0 |
| Sentry (free tier, 5k errors/mo) | $0 |
| **Total** | **~$40/mo** |

#### Scaling cost path (60 mastheads)

Vercel Pro ($20/user) + Cloudflare Pro ($20/mo) + Sanity Team ($99/mo) = under **$300/mo** for all 60 mastheads.

#### Exit strategy

Avoid Vercel-specific APIs (e.g. `@vercel/kv`). Use Cloudflare KV/D1 directly for data. If costs spike at scale, migrate to **Cloudflare Pages** via `@cloudflare/next-on-pages` with minimal code changes.

### Cache strategies (Workbox)

| Content | Strategy | Notes |
|---------|----------|-------|
| App shell (HTML/CSS/JS) | Cache-first | Update on new deploy |
| Game JSON (today's config) | Stale-while-revalidate | Always fresh, fast fallback |
| GeoJSON suburb data | Cache-first | Rarely changes (~500KB, self-hosted) |
| Archive images | Cache-first with size limit | Responsive sizes from Transform |
| API calls (scores, leaderboard) | Network-first with offline queue | Flush when back online |
| Tomorrow's game JSON | Background pre-fetch | Overnight fetch ensures instant load |

### Performance targets

- App shell: <100ms from SW cache
- First contentful paint: <200ms
- Time to interactive: <500ms
- Lighthouse score: 95+
- Bundle: ~95KB app shell + ~20-40KB per game renderer (code-split)

---

## 5. The five games

All games are **config-driven**: a generic renderer reads a JSON config from the CMS. Adding a new daily puzzle = adding a JSON document, not writing code.

### Game 1: Daily Mini Crossword

**Renderer**: `CrosswordRenderer`
**Type**: 5x5 word puzzle with emoji clues
**Cadence**: Daily
**Tier**: Premium

```json
{
  "game_type": "crossword",
  "date": "2026-03-22",
  "size": 5,
  "clues": {
    "across": { "1": "Symbol of love", "4": "Sports stadium", "5": "They twinkle" },
    "down": { "1": "Large quantities", "2": "A distinct region", "3": "Raiders, Brumbies" }
  }
}
```

**Critical**: Solution NOT sent to client. Server validates guesses per-cell.

**Prototype issues to fix**:

- Answers hardcoded in client JS (cheatable)
- No state persistence (refresh = lost)
- No share mechanic, no streak, no completion time
- No keyboard navigation (a11y)

**Hints**: Check cell (free) → Reveal letter (1 token) → Reveal word (2 tokens)

---

### Game 2: Hunt the Landmark

**Renderer**: `LocationGuessRenderer`
**Type**: Timed map-based location guessing (60+ Canberra locations)
**Cadence**: Daily (10 rounds from rotating pool)
**Tier**: Premium

```json
{
  "game_type": "landmark_hunt",
  "date": "2026-03-22",
  "rounds": 10,
  "time_limit_sec": 8,
  "locations": [
    { "name": "Telstra Tower", "emoji": "📡", "lat": -35.2758, "lng": 149.0977 }
  ]
}
```

**Prototype strengths**: 60+ locations, emoji clues, distance scoring, 8-sec timer, Web Share API, fun ranks ("Stuck in the Glenloch Interchange").

**Prototype issues**: All coordinates client-side (cheatable), Leaflet from unpkg (no cache), timer uses setInterval at 50ms (battery drain).

**Hints**: Zoom to district (1 token) → Distance ring 2km (2 tokens)

---

### Game 3: Map Games (Suburb Challenge)

**Renderer**: `SuburbChallengeRenderer`
**Type**: GeoJSON suburb identification with regional variants
**Cadence**: Always available (5 regions + master)
**Tier**: Premium (one region free as teaser)

```json
{
  "game_type": "suburb_challenge",
  "region": "gungahlin",
  "center": [-35.185, 149.140],
  "zoom": 12,
  "suburbs": ["AMAROO", "BONNER", "CASEY"],
  "happy_images": ["barr_happy.png", "Ricky_happy.png"],
  "sad_images": ["barr_sad.png", "Liz_sad.png"],
  "ranks": { "90": "Light Rail Lord", "70": "G-Town Guru" }
}
```

**Critical architecture win**: 6 separate HTML files (80% identical) → ONE renderer + regional JSON configs. Same component serves Belconnen, Gungahlin, Tuggeranong, Inner, Woden.

**Prototype strengths**: Local celebrity reaction images are gold. Regional humour in ranks. Share + confetti in some variants.

**Prototype issues**: GeoJSON from GitHub (~500KB per load, no cache). Feature parity inconsistent across variants.

**Hints**: Highlight neighbouring suburbs (1 token)

---

### Game 4: North vs South

**Renderer**: `BinarySortRenderer`
**Type**: Speed-based suburb sorting (North or South of the lake?)
**Cadence**: Daily
**Tier**: **FREE** (this is the acquisition funnel game)

```json
{
  "game_type": "binary_sort",
  "rounds": 15,
  "time_per_round_ms": 5000,
  "categories": {
    "NORTH": { "color": "#3498db", "label": "North" },
    "SOUTH": { "color": "#e67e22", "label": "South" }
  },
  "items": [{ "name": "BRADDON", "category": "NORTH" }],
  "divider_line": [[-35.29, 149.01], [-35.29, 149.22]]
}
```

**Why this is the free game**: Best mechanic of the five. Binary choice + time pressure + speed scoring = highly addictive. 15 rounds x 5 seconds = ~2 minutes. Instantly understandable. Two big mobile buttons. Reusable: "East vs West", "ACT vs NSW", "Pre-self-gov vs Post".

**Prototype strengths**: Timer colour transition (green→yellow→red), floating score popup, "The Wall" divider line on map.

**Ship this first (week 3).**

**Hints**: Brief map flash showing suburb location (1 token)

---

### Game 5: Retro Canberra / Flashback Friday

**Renderer**: `TimelineGuessRenderer`
**Type**: Archive photo year-guessing with sepia-to-colour reveal
**Cadence**: Weekly (9 photos per set, refreshed Fridays)
**Tier**: Premium

```json
{
  "game_type": "timeline_guess",
  "date": "2026-03-22",
  "title": "Flashback Friday",
  "year_range": [1920, 2020],
  "photos": [
    {
      "image": "cdn/archive/1994-raiders-gf.jpg",
      "year": 1994,
      "credit": "Canberra Times",
      "desc": "Raiders celebrate the 36-12 Grand Final demolition...",
      "hint_decade": "1990s",
      "hint_context": "Taken at a Grand Final"
    }
  ]
}
```

**Prototype strengths**: Sepia-to-colour 3s reveal is beautiful. Editorial-quality content with credits and facts. Scoring based on year proximity.

**Prototype issues**: 9 images hardcoded. No lazy loading, no responsive sizes. No share mechanic.

**#1 candidate for AI agent automation**: Agent queries Valencia for archive photos with date metadata → generates JSON weekly → editor approves batch.

**Hints**: Decade bracket (1 token) → Context clue (1 token)

---

## 6. Accessibility (WCAG 2.1 AA — Phase 1)

- Keyboard navigation for every game (arrow keys, Tab, Enter)
- Screen reader: ARIA live regions for scores/timers/feedback
- Colour-blind safe: pattern + colour, never colour alone. Toggle in settings
- Motion: respect `prefers-reduced-motion`. Wrap confetti/animations
- Timed games: "Extended time" mode (2x timer) in settings
- Auto-advance: always provide a manual "Next" button alongside setTimeout
- Contrast: minimum 4.5:1 for text (current prototypes fail — #888 on white is 3.5:1)
- Focus indicators: visible on all interactive elements

---

## 7. Dark mode (Phase 1)

Built into design system from day 1 via Tailwind `dark:` variants + CSS custom properties.

| Element | Light | Dark |
|---------|-------|------|
| Page background | #ffffff | #0a0a0a |
| Surface/cards | #f8f9fa | #1a1a1a |
| Primary text | #111111 | #e8e8e8 |
| Secondary text | #666666 | #999999 |
| Borders | #e0e0e0 | #2a2a2a |
| Correct state | #22c55e | #4ade80 |
| Wrong state | #ef4444 | #f87171 |
| CT brand blue | #00558c | #3b9fd4 |
| Map tiles | CartoDB light_nolabels | CartoDB dark_nolabels |

User override: Light / Dark / System toggle in settings, stored in IndexedDB.

---

## 8. Hints system

Daily hint tokens: 3 (free/basic), 5 (premium). Reset at midnight AEDT.

| Game | Tier 1 | Tier 2 |
|------|--------|--------|
| Crossword | Check cell (free) | Reveal letter (1 token) |
| Hunt the Landmark | Zoom to district (1 token) | Distance ring 2km (2 tokens) |
| Map Games | Highlight neighbours (1 token) | — |
| North vs South | Brief map flash (1 token) | — |
| Flashback Friday | Decade bracket (1 token) | Context clue (1 token) |

Hint usage tracked in analytics for difficulty calibration: if >40% use a hint on the same question, flag it in CMS.

---

## 9. Analytics event taxonomy

Every event carries `piano_uid` as a user property (the join key to Dijon subscription data).

| Event | Properties | Measures |
|-------|-----------|----------|
| page_view | page, referrer, utm_source, user_type | Traffic source |
| game_start | game_type, game_id, date, is_free, user_type | DAU per game |
| game_complete | game_type, score, time_spent, attempts, streak_length | Completion rate |
| game_abandon | game_type, progress_pct, time_before_abandon | Drop-off points |
| share_result | game_type, score, share_channel, streak | Share rate |
| share_click_through | share_id, landing_game, converted_to_play | Viral coefficient |
| paywall_impression | game_type, user_games_played, trigger_context | Paywall exposure |
| paywall_click | cta_variant, price_shown, user_streak_length | Conversion intent |
| subscription_start | plan_type, entry_point, referrer_game | Attribution |
| streak_milestone | streak_length (7/30/100), game_type | Habit formation |
| cross_engage | session_games_played, session_articles_read | THE key metric |
| hint_used | game_type, hint_tier, round, time_before_hint | Difficulty calibration |
| push_received / push_opened | notification_type, game_type | Push effectiveness |

---

## 10. Testing strategy

### Test layers

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | **Vitest** | Renderers, hint logic, scoring algorithms, storage helpers |
| Component | **React Testing Library** | GameShell, ShareCard, HintButton, each renderer in isolation |
| Integration | **Vitest + MSW** | API routes (`/api/validate`, `/api/score`), Piano SDK mock, CMS fetch |
| E2E | **Playwright** | Full game flows per renderer — start, play, complete, share, streak persistence |
| Visual regression | **Playwright screenshots** | Dark mode, card layouts, map rendering across breakpoints |
| Accessibility | **axe-core + Playwright** | Automated WCAG 2.1 AA checks on every page, every PR |
| Performance | **Lighthouse CI in GitHub Actions** | Block merges that drop below 90 |

### Golden game fixtures

Every renderer gets a "golden game" fixture — a known JSON config with known correct answers. E2E tests play through a full game deterministically using these fixtures. Fixtures live in `__fixtures__/` per game type.

### CI pipeline

```
PR opened → lint + type-check → unit + component tests → build → E2E (Playwright) → Lighthouse CI → a11y audit → deploy preview
```

Block merge on any failure. Playwright tests run against the Vercel preview deploy URL.

---

## 11. Error monitoring — Sentry

| Concern | Sentry Feature | Implementation |
|---------|----------------|----------------|
| Frontend JS errors | Browser SDK + automatic instrumentation | `@sentry/nextjs` in `layout.tsx`, captures unhandled errors + promise rejections |
| API route failures | Server-side SDK | Auto-wraps Next.js API routes, captures 5xx with request context |
| Service worker issues | Manual capture | `Sentry.captureException()` for SW fetch failures and cache misses |
| Piano SDK failures | Manual capture | Wrap Piano calls, report auth/entitlement errors with user context |
| AI agent failures | Server-side SDK on Cloud Functions | Track Claude API latency, validation failures, timeouts via Sochi |
| Map rendering errors | Manual capture | MapLibre GL error handler → `Sentry.captureException()` |
| Performance | Sentry Performance (Traces) | Track game load time, API latency, LCP/FID/CLS per game type |
| Session Replay | Sentry Replay | Capture sessions around errors to reproduce gameplay bugs |

### Sentry context tags on all errors

- `piano_uid` — correlate with PostHog analytics and Dijon subscription data
- `game_type` — identify which game is failing
- `user_type` — anonymous / basic / premium
- `device_id` — for anonymous user tracking
- `masthead` — which ACM publication (canberratimes, newcastleherald, etc.)

### Alerting

| Alert | Condition | Channel |
|-------|-----------|---------|
| Error rate spike | >5% error rate on any game type over 5 min | Slack + PagerDuty |
| API latency | p95 > 2s on `/api/validate` or `/api/score` | Slack |
| Piano outage | >10 consecutive auth failures | Slack + PagerDuty |
| AI agent failure | Any agent fails to produce valid JSON | Slack (non-urgent, editor notified) |
| New issue | Any new Sentry issue in `production` environment | Slack |

### Dashboards

- Per-game error rate (real-time)
- API latency p50/p95/p99
- Core Web Vitals per page (LCP, FID, CLS)
- Piano SDK success rate
- AI agent success rate + latency
- Session Replay queue for gameplay bugs

---

## 12. Rate limiting

Rate limiting enforced at two layers: Cloudflare edge (IP-based) and application middleware (user-based).

### Edge layer (Cloudflare Rate Limiting rules)

| Endpoint | Limit | Action |
|----------|-------|--------|
| `/api/validate` | 60 req/min per IP | Block with 429 |
| `/api/score` | 30 req/min per IP | Block with 429 |
| `/api/widget` | 120 req/min per IP | Block with 429 |
| All `/api/*` | 200 req/min per IP | Block with 429 |

### Application layer (middleware using Cloudflare KV)

| Endpoint | Limit (authenticated) | Limit (anonymous) | Purpose |
|----------|----------------------|-------------------|---------|
| `/api/validate` | 30 req/min per Piano UID | 15 req/min per device ID | Prevent brute-forcing answers |
| `/api/score` | 10 req/min per Piano UID | 5 req/min per device ID | One per game completion realistically |
| Hint redemption | 5 req/min per user | 3 req/min per device | Prevent hint abuse |

### Implementation

- Cloudflare edge rules: configured in Cloudflare dashboard, zero application code
- Application middleware: lightweight Next.js middleware reads `piano_uid` from cookie, checks request count in Cloudflare KV, returns 429 with `Retry-After` header if exceeded
- Abuse detection: if a user hits rate limits >10 times in an hour, flag in New Relic for review

---

## 13. Content moderation — self-service editorial approval

**Principle: AI never auto-publishes. Editors are always the final gate. Zero dev effort after initial CMS setup.**

### Workflow

```
AI Agent generates puzzle JSON (scheduled daily/weekly)
    → Pushes to Sanity CMS as "Draft" status
    → Editor receives email/Slack notification: "3 new puzzles ready for review"
    → Editor opens Sanity Studio (web UI)
    → Editor sees live preview of the puzzle rendered in an iframe
    → Editor actions:
        ├── Approve → moves to "Scheduled" (publishes at midnight AEDT)
        ├── Edit → tweak clues/answers/images in-place, then approve
        ├── Reject → moves to "Archived" with rejection reason
        └── Request regeneration → triggers agent to produce a new variant
    → At publish time, Sanity webhook fires:
        ├── Purges Cloudflare CDN cache for that game's JSON
        └── Triggers ISR revalidation on Vercel
    → If no puzzle approved by publish time → fallback "encore" puzzle (previous day's) with "encore" label
```

### Sanity Studio features (no dev effort after setup)

| Feature | How it works |
|---------|-------------|
| **Live preview pane** | Custom iframe embeds the actual game renderer fed by draft JSON — editors play the puzzle before approving |
| **Scheduled publishing** | Native Sanity feature. Editor picks date/time, content auto-publishes |
| **Workflow states** | Draft → In Review → Scheduled → Published → Archived |
| **Role-based access** | Regional editors only see their masthead's content workspace |
| **Audit log** | Who approved what, when — editorial accountability |
| **Batch operations** | Approve/reject multiple puzzles at once (e.g. weekly Flashback batch of 9 photos) |
| **Diff view** | See exactly what the AI generated vs what the editor changed |
| **Validation rules** | Schema enforces required fields, valid date ranges, answer length constraints — invalid puzzles can't be published |

### Content quality signals

- If >40% of players use a hint on the same question → auto-flag in CMS for editor review
- If completion rate drops below 30% on a puzzle → alert editor
- If >5 players report an issue (via in-game flag button) → auto-flag puzzle

---

## 14. Rollback plan

| Scenario | Response | Mechanism | Recovery time |
|----------|----------|-----------|---------------|
| **Bad puzzle live** (wrong answer, offensive content) | Editor unpublishes in Sanity Studio | Webhook triggers Cloudflare cache purge → fallback "encore" puzzle loads | < 2 min |
| **Broken deploy** (app crash after deploy) | Instant rollback to previous deployment | Vercel dashboard one-click or `vercel rollback` CLI | < 1 min |
| **Bad AI agent output** (batch of nonsensical puzzles) | All AI content lands as Draft — never auto-publishes | CMS workflow gate prevents bad content reaching users | No impact |
| **Piano outage** (auth system down) | Graceful degradation — treat all users as anonymous, allow free games, disable premium gates | Circuit breaker in `lib/piano.ts` with New Relic alert | Automatic |
| **Cloudflare KV corruption** (leaderboard/streak data) | Restore from nightly backup | Scheduled Cloudflare Worker exports KV to R2 bucket nightly | < 30 min |
| **Map tile provider outage** | Fallback to cached tiles via service worker + static fallback image | Workbox cache-first strategy for map tiles | Automatic |
| **CMS outage** (Sanity down) | Games continue to work — content is cached on CDN. No new publishes until restored | CDN serves stale content, ISR stops revalidating | No player impact |

### Key principle

Every layer has a degradation path. No single service failure takes down the entire games experience.

---

## 15. Multi-masthead content operations

### Two-tier content model

**Tier 1 — Regional editors (human, per masthead)**

Each masthead has a designated editor with Sanity Studio access to their workspace. They are responsible for:

- Setting regional flavour: suburb names, landmarks, local celebrities for reaction images
- Selecting archive photos from Valencia for their region
- Approving/rejecting/editing AI-generated content for their masthead
- Creating region-specific game variants (e.g. "North vs South of the river" for Newcastle)
- Curating the "Flashback Friday" photo selection with local editorial judgement

**Tier 2 — AI agents (automation, assists editors)**

| Agent | Source | Output | Editor role |
|-------|--------|--------|-------------|
| **Crossword agent** | Queries Silverstone for that masthead's recent stories | Locally-themed clues + grid as Draft | Review clues for accuracy, tweak local references |
| **Flashback agent** | Queries Valencia for that masthead's archive photos with date metadata | Photo + year + description as Draft | Verify photo relevance, add editorial context |
| **Trivia agent** | Pulls local history, sports, landmarks from Silverstone archive | Quiz questions as Draft | Check facts, remove duplicates, adjust difficulty |
| **Suburb/Map agent** | ABS boundary data for masthead region | GeoJSON configs + suburb lists | Verify suburb names, confirm regional boundaries |
| **Landmark agent** | Local landmarks database + geocoding | Location configs with coordinates + clues | Verify coordinates, add local colour to clues |

### Scaling path

| Phase | Mastheads | Editor effort | AI effort |
|-------|-----------|---------------|-----------|
| **Pilot** (weeks 1-12) | Canberra only | Editor does everything hands-on, trains agents | Learning phase — agents produce drafts, editor corrects |
| **Expansion** (months 3-6) | 5-10 mastheads (Newcastle, Launceston, Ballarat, etc.) | Editors review + approve AI output (~20 min/day) | Agents handle 80% of content generation |
| **Scale** (months 6-12) | All 60 mastheads | Light-touch review (~10 min/day per masthead) | Agents reliably produce publishable content with minimal edits |

### Content sharing across mastheads

Some content works across all mastheads without localization:

- Crossword grids with non-regional clues
- General knowledge trivia
- National/historical Flashback photos

Shared content lives in a "Network" workspace in Sanity. Regional editors can pull from the network pool and add local supplements. This reduces total content production effort significantly.

---

## 16. Project structure

```
games.canberratimes.com.au/
├── app/
│   ├── layout.tsx                    # Shared shell: header, Piano SDK, analytics, dark mode, Sentry browser init
│   ├── page.tsx                      # Games Hub (daily challenge, game list, streak)
│   ├── crossword/page.tsx            # CrosswordRenderer + today's config
│   ├── landmark/page.tsx             # LocationGuessRenderer + today's config
│   ├── map/[region]/page.tsx         # SuburbChallengeRenderer + region config
│   ├── north-vs-south/page.tsx       # BinarySortRenderer + config (FREE game)
│   ├── flashback/page.tsx            # TimelineGuessRenderer + weekly config
│   ├── leaderboard/page.tsx          # Cross-game unified leaderboard
│   ├── archive/page.tsx              # Past puzzles browser (premium)
│   └── api/
│       ├── validate/route.ts         # Server-side answer validation (rate limited)
│       ├── score/route.ts            # Submit scores, update streaks (rate limited)
│       └── widget/route.ts           # JSON for Suzuka homepage embed
├── components/
│   ├── GameShell.tsx                  # Shared wrapper: header, score, streak, share, hints
│   ├── ShareCard.tsx                  # Shareable result card generator
│   ├── MapBase.tsx                    # MapLibre wrapper (3 games use this)
│   ├── HintButton.tsx                # Hint token UI + spend logic
│   ├── renderers/
│   │   ├── CrosswordRenderer.tsx
│   │   ├── LocationGuessRenderer.tsx
│   │   ├── SuburbChallengeRenderer.tsx
│   │   ├── BinarySortRenderer.tsx
│   │   └── TimelineGuessRenderer.tsx
│   └── ui/                           # Buttons, modals, timer, confetti, dark toggle
├── lib/
│   ├── piano.ts                      # Piano SDK wrapper (with circuit breaker)
│   ├── storage.ts                    # idb-keyval: streaks, progress, hints, offline queue
│   ├── analytics.ts                  # PostHog helpers with piano_uid
│   ├── sanity.ts                     # CMS client
│   ├── hints.ts                      # Hint token economy (daily reset, tier costs)
│   ├── rate-limit.ts                 # Rate limiting middleware (Cloudflare KV)
│   └── sentry.ts                     # Sentry helpers: captureGameError, setUserContext
├── __fixtures__/                     # Golden game fixtures for testing
│   ├── crossword.json
│   ├── landmark-hunt.json
│   ├── suburb-challenge.json
│   ├── binary-sort.json
│   └── timeline-guess.json
├── __tests__/
│   ├── unit/                         # Vitest unit tests
│   ├── integration/                  # Vitest + MSW integration tests
│   └── e2e/                          # Playwright E2E tests
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Workbox service worker
│   └── geo/
│       └── act-suburbs.json          # Self-hosted GeoJSON (~500KB, cached by SW)
└── agents/
    ├── trivia-agent.ts               # Queries Silverstone, generates trivia JSON
    ├── flashback-agent.ts            # Queries Valencia, pairs photos with years
    ├── crossword-agent.ts            # Generates grids with local themes
    ├── landmark-agent.ts             # Local landmarks + geocoding
    └── schemas/                      # JSON validation schemas per game type
```

---

## 17. Build sequence

| Week | Deliverable |
|------|-------------|
| 1-2 | Next.js app shell + GameShell + Piano integration + PostHog + Sentry + **design system (dark mode + a11y foundations)** + testing infrastructure (Vitest + Playwright) |
| 3 | **BinarySortRenderer (North vs South)** as free daily game + keyboard controls + screen reader + rate limiting on API routes |
| 4 | Service worker + IndexedDB + streaks + **hint token system** |
| 5-6 | MapLibre + SuburbChallengeRenderer + self-hosted GeoJSON + dark tiles + keyboard search fallback |
| 7 | LocationGuessRenderer + zoom/distance hints |
| 8 | CrosswordRenderer + server-side validation + full keyboard nav + hints |
| 9 | TimelineGuessRenderer + image pipeline (Transform) + hints |
| 10 | Sanity CMS + editorial moderation workflow + live preview pane + first AI agent + hint_context fields in schemas |
| 11-12 | Games Hub page + Suzuka widget + push notifications + share cards + colour-blind mode + a11y audit + rollback testing |

**Ship North vs South by week 3. Don't wait for all 5 games.**

---

## 18. ACM network scaling

Same Next.js app, different CMS workspace per masthead:

- `games.newcastleherald.com.au` → Newcastle content
- `games.theexaminer.com.au` → Launceston content
- `games.thecourier.com.au` → Ballarat content

Auth (Piano), infrastructure (Vercel/CF), and game renderers are shared. Only content differs. Build once, deploy to 60+ mastheads.

---

## 19. Prototype source files

All uploaded to this project. Review before building:

- `Crossword_emoticon.html` — Game 1
- `Hunt_the_landmark.html` — Game 2
- `Belconnen.html`, `Gungahlin.html`, `Inner_Canberra.html`, `Tuggers.html`, `Woden__Weston___Molonglo.html`, `canberra_master_map.html` — Game 3 variants
- `North_v_South.html` — Game 4
- `Retro_Canberra.html` — Game 5
- `barr_happy.png`, `barr_sad.png`, `Ricky_happy.png`, `Ricky1_sad.png`, `Liz_sad.png`, `Nick_sad.png`, `Parton_sad.png` — Reaction images
- `img1.jpg` through `img9.jpg` — Flashback Friday archive photos
- `logo.png` — CT logo
