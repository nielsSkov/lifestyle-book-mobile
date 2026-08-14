# Migration Plan

The existing Flask application is the behavioral and visual specification for this migration. Existing templates, CSS, Plotly helpers, domain logic, and tests should be ported where the platform permits. Differences require an explicit browser, IndexedDB, PWA, or Capacitor reason.

## Test Inventory

The legacy suite contains 193 collected test cases across 16 files.

| Legacy tests                  | Cases | Mobile replacement                                                            |
| ----------------------------- | ----: | ----------------------------------------------------------------------------- |
| `test_app.py`                 |    66 | TypeScript repository tests, React component tests, and Playwright user flows |
| `test_weight_data.py`         |    24 | TypeScript domain and IndexedDB repository tests                              |
| `test_weight_plotly.py`       |    10 | TypeScript figure tests and chart component tests                             |
| `test_plan_model.py`          |     9 | TypeScript domain tests                                                       |
| `test_plan_apply.py`          |     5 | TypeScript domain and transactional repository tests                          |
| `test_plan_backup.py`         |    22 | Transactional IndexedDB revision, backup, and recovery tests                  |
| `test_sleep_data.py`          |    12 | TypeScript domain and repository tests                                        |
| `test_sleep_plot.py`          |     4 | TypeScript figure and component tests                                         |
| `test_daily_data.py`          |    10 | TypeScript domain and repository tests                                        |
| `test_daily_plot.py`          |     4 | TypeScript figure and component tests                                         |
| `test_achievement_catalog.py` |     3 | TypeScript domain tests                                                       |
| `test_lifestyle_config.py`    |    11 | TypeScript settings and repository tests                                      |
| `test_plotly_support.py`      |     1 | Chart component and Playwright interaction tests                              |
| `test_fetch_weight.py`        |     3 | Excluded legacy SSH workflow unless synchronization is designed later         |
| `test_server_sync.py`         |     8 | Excluded legacy server deployment behavior                                    |
| `test_deploy_plan.py`         |     1 | Excluded legacy SCP deployment behavior                                       |

Filesystem permissions, `flock`, fsync, SSH, and Flask route-shape assertions are not portable contracts. Their user-visible guarantees must be replaced with IndexedDB transactions, schema validation, revision checks, import/export tests, offline tests, and platform lifecycle tests.

## Migration Order

### 1. Persistence And Validation

- Introduce a versioned IndexedDB schema and migration tests.
- Port strict weight/date parsing, the inclusive 0-700 kg bounds, sorted replacement, and deletion behavior from `test_weight_data.py`.
- Reject corrupt stored/imported records instead of silently filtering them.
- Remove automatic representative-data seeding before real data entry is enabled.
- Test persistence across reload, offline startup, and application lifecycle changes.

### 2. Complete Weight Entry

- Port the existing navigation, `Daily record` entry card, date stepping, decimal input, save status, latest summary, and add/update/delete behavior.
- Convert the Weight portions of `test_app.py` into repository, component, and Playwright tests.
- Preserve asynchronous save behavior and existing-value prefill when the date changes.

### 3. Weight Figures

- Generalize the existing Plotly configuration and persistent hover/tap readout.
- Port the recorded/plan, difference-from-plan, and rolling four-week rate contracts from `test_weight_plotly.py`.
- Preserve plan gaps, interpolation limits, linked x-axis ranges, touch interaction, and compact layouts.

### 4. Weight Plan

- Port interval generation, taper, bounds, erase gaps, overlap validation, candidate previews, and draft restoration.
- Port apply revisions and transactional backups before allowing plan mutation.
- Add import preview/apply, export/share, backup preview, restore, delete, retention, deduplication, and damaged-plan recovery.

### 5. Sleep

- Port partial sleep/wake records, night rollover, validation, replacement, and deletion.
- Port timing and duration figures, complete-night gaps, synchronized ranges, and night labels.

### 6. Settings And Achievements

- Persist the optional name and active achievement catalog.
- Preserve default subtitle, possessive formatting, fixed catalog order, validation, and historical hidden-achievement values.

### 7. Daily

- Port per-achievement autosave, stable storage keys, failed-save rollback, movement/food bands, and Active Days semantics.
- Preserve historical inactive movement in Active Days and adaptive Plotly tile spacing.

### 8. Platform Hardening

- Cover all screens with offline CRUD/reload, schema migration and rollback, storage failure recovery, pause/resume, accessibility, touch, font scaling, and Android file/share behavior.
- Keep the LAN preview for rapid visual feedback and GitHub Pages for trusted-HTTPS installation and offline checks.

## Shared Contracts

- Date arithmetic must be calendar-safe and clamp future navigation.
- Plotly charts use only Zoom, Pan, and Reset axes; they are responsive and disable scroll zoom.
- Floating hover labels remain suppressed. Hover and tap update a persistent accessible readout below each chart.
- Navigation, labels, typography, colors, spacing, icons, and workflows come from the existing application unless a platform constraint requires a documented change.
- Settings/catalog storage must precede Daily; Weight storage must precede Weight Plan; backup transactions must precede plan mutation.

## Excluded Legacy Infrastructure

`fetch_weight.py`, `server_sync.py`, `deploy_plan.py`, and their SSH/SCP tests are not part of the offline mobile migration. Any future synchronization feature needs a separate design for authentication, encryption, conflict resolution, and offline reconciliation.
