# PocketCircle — Frontend Asset Manifest & Enhancement Inventory (`assets.md`)

> **Design Alignment:** Strictly aligned with [`Frontend/DESIGN.md`](file:///f:/Projects/pocket_circle/Frontend/DESIGN.md) and [`Frontend/tokens.json`](file:///f:/Projects/pocket_circle/Frontend/tokens.json) ("Join Parker — Banker's ledger meets indie magazine").
> **Visual Philosophy:** Product-centric and mathematical. No stock photography, no lifestyle imagery, no human faces. Visuals are driven by the hero credit card product asset, geometric vector glyphs, abstract gradient washes, and high-contrast typography.

---

## 1. Executive Summary & Asset Matrix

| Category | Priority | Format | Purpose | Target Storage Path | Target Size Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brand Identity** | P0 (Critical) | SVG, ICO, PNG | App icon, favicons, wordmark, web clip icons | `Frontend/public/` | < 15 KB |
| **Social / Open Graph** | P0 (Critical) | PNG, WebP | Social link previews (Discord, X, WhatsApp, Slack) | `Frontend/public/og/` | < 120 KB |
| **Hero Product Asset** | P1 (High) | SVG / WebP | Dark credit card visual with blue-to-orange gradient | `Frontend/src/assets/product/` | < 45 KB |
| **Abstract Gradients & Meshes** | P1 (High) | SVG / CSS | Atmospheric aura and subtle parchment mesh | `Frontend/src/assets/textures/` | < 25 KB |
| **Empty State Illustrations** | P1 (High) | SVG | Geometric vector feedback for 0-data views | `Frontend/src/assets/illustrations/` | < 15 KB each |
| **Expense Category Icons** | P2 (Medium) | SVG | Category markers for multi-payer bill splitting | `Frontend/src/assets/categories/` | < 3 KB each |
| **Self-Hosted Web Fonts** | P2 (Medium) | WOFF2 | Production latency elimination for Inter & Gambetta | `Frontend/public/fonts/` | < 35 KB per font |
| **Micro-Delight Haptics / Audio** | P3 (Optional) | MP3, OGG | Subtle tactile feedback for settling debts & copy | `Frontend/public/audio/` | < 12 KB each |

---

## 2. Brand Identity & Favicon Assets

These assets establish the visual entry point across browser tabs, bookmarks, mobile homescreens, and desktop launchers.

### 2.1 Favicon & App Icons
- [ ] **`favicon.svg`** (`Frontend/public/favicon.svg`)
  - **Specs:** Vector SVG with `viewBox="0 0 32 32"`.
  - **Design:** Paper White or Electric Blue circular container with high-contrast `PC` monogram and 1px hairline border.
- [ ] **`favicon.ico`** (`Frontend/public/favicon.ico`)
  - **Specs:** Multi-resolution 16x16, 32x32, 48x48.
- [ ] **`apple-touch-icon.png`** (`Frontend/public/apple-touch-icon.png`)
  - **Specs:** 180x180 PNG with Parchment (`#f2f1ec`) background and Electric Blue icon glyph.
- [ ] **`android-chrome-192x192.png` & `android-chrome-512x512.png`** (`Frontend/public/`)
  - **Specs:** PWA manifest web clip icons for mobile Android installs.
- [ ] **`site.webmanifest`** (`Frontend/public/site.webmanifest`)
  - **Specs:** JSON configuration detailing app name, theme color (`#ffffff`), background color (`#ffffff`), and icon paths.

### 2.2 Brand Wordmark & Monograms
- [ ] **`pocketcircle-wordmark-light.svg`** (`Frontend/src/assets/brand/wordmark-light.svg`)
  - **Specs:** SVG vector displaying `PocketCircle` wordmark with the signature Electric Blue dot (`#5196fe`) on Paper White.
- [ ] **`pocketcircle-wordmark-dark.svg`** (`Frontend/src/assets/brand/wordmark-dark.svg`)
  - **Specs:** Inverted white text for dark panels and the hero credit card visual.
- [ ] **`pocketcircle-symbol.svg`** (`Frontend/src/assets/brand/symbol.svg`)
  - **Specs:** Standalone 24x24 geometric circle monogram for compact headers, avatar fallbacks, and mobile bars.

---

## 3. Open Graph & Social Preview Assets

When users share a link to PocketCircle or invite friends via Pocket ID links, these preview cards provide instant professional credibility.

- [ ] **`og-banner.png`** (`Frontend/public/og/og-banner.png`)
  - **Dimensions:** 1200 x 630 px (1.91:1 ratio), optimized under 150 KB.
  - **Content:**
    - Background: Clean Paper White (`#ffffff`) canvas with subtle Parchment border frame.
    - Left side: Inter Bold headline with Gambetta italic flourish: *"Shared expenses, settled with frictionless clarity."*
    - Right side: Hero credit card mockup (dark card body with the electric-blue-to-ember-orange gradient overlay and live ledger balances).
    - Subtext: *"Deterministic math for circles of trust · 0 platform fees · Numeric Pocket IDs"*.
- [ ] **`twitter-card.png`** (`Frontend/public/og/twitter-card.png`)
  - **Dimensions:** 1200 x 600 px formatted for Twitter Summary Large Image card.

---

## 4. Product Visuals & Mockups

As mandated in `DESIGN.md`, the hero visual is the literal product card asset.

### 4.1 Digital Ledger Credit Card Visual
- [ ] **`ledger-card-visual.svg`** (`Frontend/src/assets/product/ledger-card-visual.svg`)
  - **Dimensions:** Aspect ratio ~1.586:1 (standard ISO/IEC 7810 ID-1 credit card proportions).
  - **Visual Layers:**
    1. Base container: Ink Black (`#1b1d20`) card surface with 24px border-radius.
    2. Multi-color gradient overlay: Radial wash shifting from Electric Blue (`#5196fe`) to Ember Orange (`#f9754e`) and subtle Coral Pink (`#ff528f`).
    3. Metallic chip glyph: Matte metallic gold/silver 6-contact smart chip geometry.
    4. Contactless waves icon: 3 concentric geometric arcs indicating instant peer settlement.
    5. Monospace ledger credentials: Embossed Pocket ID lettering (e.g. `ID: 4892 0184 92`), group title (*Goa Villa & Meals*), and real-time net balance (+₹12,000.00).

### 4.2 Abstract Atmosphere Textures
- [ ] **`parchment-grid.svg`** (`Frontend/src/assets/textures/parchment-grid.svg`)
  - **Specs:** Subtle 32x32 hairline grid pattern in Sand (`#e1dfd8`) at 25% opacity for backgrounds of ledger sections.
- [ ] **`blue-aura-glow.svg`** (`Frontend/src/assets/textures/blue-aura-glow.svg`)
  - **Specs:** Radial gaussian blur gradient in Electric Blue (`#5196fe`) at 15-20% opacity for hero lighting under the product card.

---

## 5. Geometric Empty State Illustrations

When user data is empty (no friends added yet, no active ledger expenses, no pending invitations), clean vector spot illustrations guide the user on what to do next without cluttering the UI.

- [ ] **`empty-circle-friends.svg`** (`Frontend/src/assets/illustrations/empty-circle-friends.svg`)
  - **Design:** Minimalist hairline illustration showing two overlapping geometric circles joining together with an Electric Blue link dot and a 10-digit number motif.
  - **Role:** Displayed on `Friends_page.tsx` when `data.friends.length === 0`.
- [ ] **`empty-requests.svg`** (`Frontend/src/assets/illustrations/empty-requests.svg`)
  - **Design:** A clean envelope/card slot receiving a digital token with an Electric Blue badge.
  - **Role:** Displayed on `Friends_page.tsx` under "Requests for You".
- [ ] **`empty-ledger-receipt.svg`** (`Frontend/src/assets/illustrations/empty-ledger-receipt.svg`)
  - **Design:** Banker's ledger slip with zeroed columns and an "ALL GOOD" balance checkmark seal.
  - **Role:** Displayed on `Dashboard_page.tsx` under "Recent Ledger Activity".
- [ ] **`no-search-results.svg`** (`Frontend/src/assets/illustrations/no-search-results.svg`)
  - **Design:** Minimalist magnifying glass inspecting a 10-digit numeric sequence with a subtle dashed outline.
  - **Role:** Displayed when user search yields 0 results.

---

## 6. Category Icons for Group Ledgers (Milestone F8+)

When group expense ledgers are added, transactions require crisp, geometric category markers matching the 48x48 icon tile convention:

- [ ] **`cat-dining.svg`** — Cutlery / drink geometry for restaurants, cafes, and dinners.
- [ ] **`cat-travel.svg`** — Taxi / flight / fuel geometry for cabs, train tickets, road trips.
- [ ] **`cat-housing.svg`** — Villa / key geometry for hotel bookings, Airbnb, and apartment rent.
- [ ] **`cat-groceries.svg`** — Bag / cart geometry for supermarket runs and pantry split.
- [ ] **`cat-entertainment.svg`** — Ticket / music geometry for concerts, games, and streaming subscriptions.
- [ ] **`cat-utilities.svg`** — Lightning bolt / flame geometry for electricity, WiFi, and gas bills.
- [ ] **`cat-settle.svg`** — Handshake / double arrow geometry for debt resolution and settlements.

*All icons rendered with 1.5px consistent stroke weight in Electric Blue (`#5196fe`) on 48x48 rounded-square tiles (12.8px radius).*

---

## 7. Self-Hosted Typography Assets (Production Resilience)

To avoid external network roundtrips to Google Fonts and eliminate layout shift (CLS):

- [ ] **`Inter-Regular.woff2`** (Weights 400, 500, 600, 700) (`Frontend/public/fonts/inter/`)
- [ ] **`Newsreader-MediumItalic.woff2`** (or `Gambetta-MediumItalic.woff2`) (`Frontend/public/fonts/serif/`)
- [ ] **`@font-face` definitions** configured inside `Frontend/src/index.css` with `font-display: swap`.

---

## 8. Micro-Audio Delights (Optional Fintech Haptics)

Tiny (< 15 KB), high-fidelity sound clips played softly (volume 0.25) to provide tactile satisfaction:

- [ ] **`copy-pop.mp3`** — Ultra-short 40ms organic click when copying the Pocket ID.
- [ ] **`request-sent.mp3`** — Clean two-tone chime when a friend request is sent or accepted.
- [ ] **`settle-celebration.mp3`** — Subtle warm chord when an expense ledger reaches zero net debt.

---

## 9. Implementation Roadmap

### Phase 1: Essential Identity (Immediate)
1. Generate `favicon.svg`, `favicon.ico`, and `apple-touch-icon.png` in `Frontend/public/`.
2. Generate Open Graph preview card `og-banner.png` (1200x630) for link sharing.
3. Replace inline chip with dedicated `ledger-card-visual.svg`.

### Phase 2: User Experience Enhancements
1. Add empty state SVG illustrations to `Friends_page.tsx` and `Dashboard_page.tsx`.
2. Integrate category icon set for group expense entries.

### Phase 3: Performance Hardening
1. Download self-hosted WOFF2 files for Inter and Newsreader/Gambetta.
2. Add offline cache headers in Vite/Cloud deployment configuration.
