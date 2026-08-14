# Lifestyle Book Mobile

A small, offline-first weight-history application built once for browsers, installable PWAs, and Android.

## Prototype scope

- One polished and accessible weight graph
- Local IndexedDB persistence with representative seed data
- Complete offline startup through a service worker
- Installable from Safari on iPad and supporting browsers elsewhere
- Self-contained Capacitor Android application
- No account, backend, synchronization, planning, or health integration yet

## Stack

- React 19, TypeScript, and Vite
- Recharts for the responsive SVG graph
- IndexedDB through `idb`
- Workbox through `vite-plugin-pwa`
- Capacitor for Android packaging
- Vitest, Testing Library, Playwright, and axe-core
- Oxlint, Prettier, GitHub Actions, Gradle lint, and Android unit tests

## Development

Use Node.js 22:

```sh
npm ci
npm run dev
```

The development server prints a local URL. Open it in a browser on the same network.

## Quality gate

```sh
npm run ci
```

This checks formatting, linting, unit/component tests with domain coverage thresholds, the production PWA build, desktop/mobile browser behavior, accessibility, self-containment, and an offline reload.

## Android

Install JDK 21 and Android SDK Platform 36, then set `ANDROID_HOME` or create `android/local.properties`.

```sh
npm run android:check
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. With USB debugging enabled and an Android device connected:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## iPad

Serve the production PWA over HTTPS, open it in Safari, then choose **Share > Add to Home Screen**. No Apple Developer membership is required for this installation route.

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE), not an OSI open-source license.
