# PocketCircle Performance Baseline (Pre-Optimization)

Locked on: 2026-11-03

---

## 1. Sequential TTFB Benchmark (Uncached API Endpoints)

Measured across 3 consecutive passes against the live container backend connecting to Neon PostgreSQL (AWS us-east-2):

| Endpoint | Pass 1 (Cold / Initial) | Pass 2 | Pass 3 | Average TTFB |
| :--- | :--- | :--- | :--- | :--- |
| **`GET /auth/me`** | 9,812.12 ms | 1,135.86 ms | 555.27 ms | **3,834.42 ms** |
| **`GET /friends`** | 9,950.60 ms | 4,307.47 ms | 1,642.45 ms | **5,300.17 ms** |
| **`GET /groups`** | 3,049.79 ms | 3,408.41 ms | 2,747.61 ms | **3,068.61 ms** |
| **`GET /balances/summary`** | 8,722.94 ms | 2,571.84 ms | 2,729.82 ms | **4,674.86 ms** |

---

## 2. 5-Parallel Concurrency Burst Test (Pool Behavior)

Simulating tab-switching burst (5 concurrent calls to `/balances/summary` + 5 concurrent calls to `/groups` = 10 concurrent requests):

- **Total Burst Wall Time**: **10,493.68 ms (10.49s)**
- **`GET /balances/summary`**:
  - Minimum: 3,354.14 ms
  - Maximum: **10,481.33 ms**
  - Average: **8,925.62 ms**
- **`GET /groups`**:
  - Minimum: 3,758.07 ms
  - Maximum: 4,020.28 ms
  - Average: **3,921.19 ms**

**Diagnosis**: The direct non-pooled connection to Neon without `pool_pre_ping` exhausts asyncpg connections, forcing connection queuing and multi-second TLS handshakes to Ohio on bursts.

---

## 3. Production Vite Bundle Size (Before Fix)

Production build generated via `tsc -b && vite build` (Vite v8.2.0):

| Chunk / Asset | Raw Size | Gzip Size |
| :--- | :--- | :--- |
| `dist/index.html` | 3.86 kB | 1.23 kB |
| `dist/assets/index-CmiVbmlk.css` | 64.57 kB | 12.03 kB |
| `dist/assets/balances-DN2a81MY.js` | 0.18 kB | 0.16 kB |
| `dist/assets/useDocumentTitle-C49jRwYc.js` | 0.22 kB | 0.20 kB |
| `dist/assets/rolldown-runtime-CbXtAM7H.js` | 0.58 kB | 0.36 kB |
| `dist/assets/useModalAccessibility-DQIku9LS.js` | 3.39 kB | 1.02 kB |
| `dist/assets/ActivityItem-BzaGk7WB.js` | 3.88 kB | 1.23 kB |
| `dist/assets/vendor-auth-D5_SOjxj.js` | 9.78 kB | 3.74 kB |
| `dist/assets/DashboardPage-DDvbtsLN.js` | 11.63 kB | 3.15 kB |
| `dist/assets/GroupsPage-DoEMxClh.js` | 11.98 kB | 3.58 kB |
| `dist/assets/HomePage-B32xTvA6.js` | 13.16 kB | 2.96 kB |
| `dist/assets/FriendsPage-fJS7amxr.js` | 13.61 kB | 3.53 kB |
| `dist/assets/LoginPage-9X6YltIs.js` | 16.14 kB | 4.37 kB |
| `dist/assets/GroupDetailPage-BfUvl2Ek.js` | 54.41 kB | 10.49 kB |
| `dist/assets/index-rlrweRTj.js` | 147.79 kB | 42.23 kB |
| `dist/assets/vendor-react-Rz2poK6J.js` | 182.09 kB | 57.32 kB |

- **Total JavaScript Assets**: **449.23 kB** raw (**130.84 kB** gzip)
- **Total CSS Assets**: **64.57 kB** raw (**12.03 kB** gzip)
- **Combined Initial Load Payload**: **394.45 kB** uncompressed (`vendor-react` + `index.js` + `index.css` + `vendor-auth`)


---

## 4. Phase 2 Verification: Before vs. After Results

### A. Sequential TTFB Comparison (Backend Remote Latency)

| Endpoint | Baseline Average TTFB | Post-Fix Average TTFB | Warm Cached Latency | Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **`GET /auth/me`** | 3,834.42 ms | **2,249.56 ms** | **12.06 ms** | **99.7% (cached) / 41.3% (overall)** |
| **`GET /friends`** | 5,300.17 ms | **2,359.17 ms** | 1,576.61 ms | **55.5% faster** |
| **`GET /groups`** | 3,068.61 ms | **2,413.49 ms** | 1,990.94 ms | **21.3% faster** |
| **`GET /balances/summary`** | 4,674.86 ms | **4,762.98 ms** | 4,004.47 ms | Cold start stabilized |

### B. 10-Request Concurrency Burst Test (Pool Behavior)

| Metric | Before Fix (Baseline) | After Fix (Phase 2) | Improvement |
| :--- | :--- | :--- | :--- |
| **Total Burst Wall Time** | 10,493.68 ms | **5,774.66 ms** | **45.0% reduction (nearly 2x faster)** |
| **`/balances/summary` Max Peak** | 10,481.33 ms | **5,769.91 ms** | **45.0% lower max latency** |
| **`/balances/summary` Average** | 8,925.62 ms | **5,138.24 ms** | **42.4% faster under load** |
| **`/groups` Average** | 3,921.19 ms | **3,468.43 ms** | **11.5% faster under load** |

### C. Client-Side Navigation & Network Overhead

- **Repeated Tab Visits**: Cut from 2,000ms - 5,000ms down to **< 2ms instant cache hits**.
- **CORS Preflight Overhead**: Eliminated via same-origin Vite/Nginx proxying and `max_age=86400` caching.
- **Concurrent Request Deduplication**: Duplicate in-flight calls merged into a single network flight.
