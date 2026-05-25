# React Native Architecture — Practical Guide

Didactic project to understand, in a simple and hands-on way, the **React Native New Architecture** (Fabric, TurboModules, JSI, Hermes) — compared with the **old architecture** based on the Bridge.

> This README is the study material. The app is just a visual aid to reinforce the concepts. Each screen's buttons trigger code that illustrates a specific point explained below.

---

## Table of Contents

1. [How to run](#how-to-run)
2. [Overall diagram — old vs new architecture](#overall-diagram--old-vs-new-architecture)
3. [Why this architecture exists](#why-this-architecture-exists)
4. [Old architecture (Bridge + Paper)](#old-architecture-bridge--paper)
5. [New Architecture: overview](#new-architecture-overview)
6. [JSI — JavaScript Interface](#jsi--javascript-interface)
7. [Fabric — the new renderer](#fabric--the-new-renderer)
8. [TurboModules and Codegen](#turbomodules-and-codegen)
9. [Thread Model](#thread-model)
10. [Hermes vs JSC](#hermes-vs-jsc)
11. [Metro Bundler and Fast Refresh](#metro-bundler-and-fast-refresh)
12. [Concurrent React on mobile](#concurrent-react-on-mobile)
13. [Reanimated 3 — JSI in practice](#reanimated-3--jsi-in-practice)
14. [Interop Layer — incremental migration](#interop-layer--incremental-migration)
15. [Tradeoffs](#tradeoffs)
16. [Ecosystem alternatives](#ecosystem-alternatives)
17. [Full flow: tap → setState](#full-flow-tap--setstate)
18. [Suggested study roadmap](#suggested-study-roadmap)
19. [References](#references)

---

## How to run

Prerequisites (install whatever is missing):

- Node ≥ 22.11
- Watchman (recommended)
- **iOS**: full Xcode (not just CLI tools), CocoaPods (`bundle install` inside `ios/`), Ruby managed by rbenv or similar
- **Android**: Android Studio + SDK, JDK 17+, `ANDROID_HOME` set

```bash
# 1) install dependencies
npm install

# 2) iOS (codegen runs via pod install, generating AppSpecs)
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios

# 3) Android (codegen runs as part of the gradle build)
npm run android
```

If the build fails, codegen usually needs to be triggered manually:

```bash
# Android
cd android && ./gradlew generateCodegenArtifactsFromSchema && cd ..

# iOS — just re-run pod install
cd ios && bundle exec pod install && cd ..
```

The New Architecture is **enabled by default** starting from React Native 0.76. No flag needed.

---

## Overall diagram — old vs new architecture

### Old Architecture (up to RN 0.68)

```
╔══════════════════════════════════════════════════════════════════════╗
║                          OLD ARCHITECTURE                            ║
╠══════════════════╦═══════════════════════╦═══════════════════════════╣
║   JS THREAD      ║       BRIDGE          ║    NATIVE (UI THREAD)     ║
║                  ║                       ║                           ║
║  ┌────────────┐  ║  ┌─────────────────┐  ║  ┌─────────────────────┐ ║
║  │  Your      │  ║  │  Serializes JSON│  ║  │  Paper Renderer     │ ║
║  │  JS code   │──╬─►│  (batch, async) │──╬─►│  (creates UIViews)  │ ║
║  │  + React   │  ║  │                 │  ║  │                     │ ║
║  └────────────┘  ║  │  Message queue  │  ║  │  NativeModules      │ ║
║        │         ║  │                 │◄─╬──│  (eager, all of     │ ║
║  ┌─────▼──────┐  ║  │                 │  ║  │   them on startup)  │ ║
║  │  JSC /     │  ║  └─────────────────┘  ║  └─────────────────────┘ ║
║  │  JavaScr.  │  ║                       ║                           ║
║  │  Core      │  ║  ⚠ Everything async   ║  ┌─────────────────────┐ ║
║  └────────────┘  ║  ⚠ JSON copy on       ║  │  Yoga Layout        │ ║
║                  ║    every call         ║  │  (another thread)   │ ║
║                  ║  ⚠ No type safety     ║  └─────────────────────┘ ║
╚══════════════════╩═══════════════════════╩═══════════════════════════╝

Flow of a native call:
  JS calls module → serializes to JSON → enqueues on Bridge →
  native deserializes → executes → serializes response →
  Bridge returns to JS → JS deserializes → callback
  (minimum: 2 serializations + 1 async round-trip)
```

### New Architecture (RN 0.76+ default)

```
╔══════════════════════════════════════════════════════════════════════╗
║                          NEW ARCHITECTURE                            ║
╠══════════════════╦═══════════════════════╦═══════════════════════════╣
║   JS THREAD      ║    JSI (direct C++)   ║    NATIVE (UI THREAD)     ║
║                  ║                       ║                           ║
║  ┌────────────┐  ║  ┌─────────────────┐  ║  ┌─────────────────────┐ ║
║  │  Your      │  ║  │  Host Objects   │  ║  │  Fabric Renderer    │ ║
║  │  JS code   │──╬─►│  (C++ ref in    │  ║  │                     │ ║
║  │  + React   │  ║  │   JS global)    │  ║  │  Receives atomic    │ ║
║  └────────────┘  ║  │                 │  ║  │  commits from the   │ ║
║        │         ║  │  No serializ.   │  ║  │  Shadow Tree        │ ║
║  ┌─────▼──────┐  ║  │  Can be sync    │──╬─►│                     │ ║
║  │  Hermes    │  ║  └─────────────────┘  ║  └─────────────────────┘ ║
║  │  (bytecode,│  ║                       ║                           ║
║  │  no JIT)   │  ║  ┌─────────────────┐  ║  ┌─────────────────────┐ ║
║  └────────────┘  ║  │  TurboModules   │  ║  │  Native TurboMod.   │ ║
║                  ║  │  (lazy, typed   │◄─╬──│  (iOS / Android)    │ ║
║                  ║  │   via codegen)  │  ║  │                     │ ║
║                  ║  └─────────────────┘  ║  └─────────────────────┘ ║
╠══════════════════╩═══════════════════════╩═══════════════════════════╣
║                   BACKGROUND / SHADOW THREAD                         ║
║                                                                      ║
║   ┌──────────────────────────────────────────────────────────────┐   ║
║   │  Shadow Tree (C++)  ──►  Yoga Layout  ──►  Atomic commit    │   ║
║   └──────────────────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════╝

Flow of a native call:
  JS accesses C++ object on the global → invokes function → result returns
  (0 serializations, can be synchronous)
```

### Direct comparison

```
                    OLD                       NEW
                    ───                       ───
Communication:      Bridge (JSON async)       JSI (direct C++)
Renderer:           Paper                     Fabric
Native modules:     NativeModules (eager)     TurboModules (lazy)
Type safety:        None at runtime           Codegen (build time)
Startup:            Loads everything          Loads only what is needed
Sync layout:        Impossible                Possible via JSI
Default JS engine:  JSC                       Hermes
```

---

## Why this architecture exists

The original React Native (2015) proved you could use React outside the browser, but the communication model had hard limits:

- **Async by nature**: every JS↔native call went through a Bridge serializing JSON in batches. Even trivial things (measuring a view, reading a constant) were asynchronous.
- **No type safety** between JS and native: everything was free-form JSON. Errors only surfaced at runtime.
- **Heavy startup**: all native modules were instantiated on boot, even ones the app would never use.
- **Animations required bypassing the Bridge** (`useNativeDriver`) to be smooth — a symptom that the normal path was too slow.

The New Architecture tackles these problems by replacing the communication protocol (Bridge → JSI), the renderer (Paper → Fabric), and the native module model (NativeModules → TurboModules), with **codegen** enforcing typed contracts.

---

## Old architecture (Bridge + Paper)

```
┌────────────┐   JSON batched, async   ┌─────────────┐
│ JS thread  │  ───────────────────►   │  Native side│
│ (JSC/Herm.)│  ◄───────────────────   │ (iOS/Andr.) │
└────────────┘                          └─────────────┘
       │
       └── Paper renderer creates UI ops ──► serializes ──► Bridge ──► UI thread
```

Characteristics:
- **Bridge**: JSON message queue between JS and native. Everything async.
- **Paper renderer**: generates UI diffs and sends serialized commands to the UI thread to apply.
- **NativeModules**: registered eagerly; JS calls by string name, receives a Promise.
- **Animated without `useNativeDriver`** was stuck on the JS thread — crossing the Bridge per frame was impossible at 60fps.

Limitations that were tolerable until they weren't:
- Synchronous layout is impossible: `measure()` is a callback because Yoga runs on the other side of the Bridge.
- Integrating React into an existing native app without flipping everything upside-down is impractical.
- Type tooling: everything is strings + JSON. Refactoring breaks silently.

---

## New Architecture: overview

Three new pillars and one cross-cutting enabler:

| Piece                 | Before                    | Now                               |
| --------------------- | ------------------------- | --------------------------------- |
| JS↔native comms       | Bridge (JSON async)       | **JSI** (direct C++ references)   |
| Native modules        | NativeModules (eager)     | **TurboModules** (lazy + typed)   |
| Renderer              | Paper (async)             | **Fabric** (C++ Shadow Tree)      |
| Type safety           | Manual, error-prone       | **Codegen** from TS specs         |

Practical results:
- Synchronous calls are viable (used judiciously).
- Faster startup (modules only load when first used).
- Type errors caught at build time, not in production.
- Layout can be synchronous when JS needs the size.

---

## JSI — JavaScript Interface

JSI is a **lean C++ API** that abstracts the JavaScript runtime (Hermes, JSC, V8). Instead of JS sending serialized messages to native, **a C++ object is exposed as a property on the JS global**. Calling `MyModule.add(1,2)` becomes a direct C++ function invocation.

```
Before (Bridge):
  JS: "Calculator.add(1, 2)"
      → serialize: {"module":"Calculator","method":"add","args":[1,2]}
      → enqueue on Bridge
      → native deserializes and executes
      → serialize response: {"result":3}
      → Bridge returns to JS
      → JS deserializes and calls callback
             ↑ minimum 2 copies + 1 async round-trip

Now (JSI):
  JS: NativeCalculator.add(1, 2)   ← C++ object lives on the JS global
      → C++ executes directly
      → returns 3
             ↑ zero serialization, can be synchronous
```

Implications:
- No intermediate JSON serialization.
- Synchronous calls are possible (the function runs on the JS thread).
- Enables "Host Objects" — JS objects whose properties are answered by C++ on demand.
- Foundation for everything: Fabric, TurboModules, and libraries like Reanimated 3 use JSI under the hood.

JSI is **not magic** — a heavy synchronous call still blocks the JS thread. The advantage is being able to *choose* between sync and async.

---

## Fabric — the new renderer

Fabric replaces Paper. Its core is a **C++ Shadow Tree** that lives close to the JS runtime via JSI.

```
  JSX in your component
         │
         ▼
  React reconciles (diff)
         │
         ▼
  Shadow Tree mutations (C++, via JSI)  ◄── no JSON here
         │
         ▼
  Yoga computes layout (background thread)
         │
         ▼
  Atomic commit  ◄── immutable "snapshot" of the new UI
         │
         ▼
  Mount on UI thread  ──► UIView (iOS) / View (Android)
```

Why this matters in practice:
- **Sync layout**: JS can request measurements and receive them without a callback.
- **Real React concurrency**: the commit is atomic — works well with Suspense, transitions, etc.
- **Fewer copies**: the UI representation is a single structure shared between JS and native.
- **Typed Host Components**: native components have a contract generated by codegen.

See the "Fabric Renderer" screen in the app: every `View`, `TextInput`, `Switch` is a native view mounted by this pipeline.

---

## TurboModules and Codegen

A **TurboModule** is the New Architecture version of a NativeModule. Three key differences:

1. **TypeScript spec** describes the contract ([src/specs/NativeCalculator.ts](src/specs/NativeCalculator.ts) in this project).
2. **Codegen** reads the spec at build time and generates:
   - On Android: an abstract Java class (`NativeCalculatorSpec`) that your Kotlin class extends.
   - On iOS: an Objective-C protocol (`NativeCalculatorSpec`) and C++ structs for constants.
3. **JSI access**: the module is exposed to JS via `TurboModuleRegistry`, with no string-based Bridge lookup.

```
  NativeCalculator.ts (your TS spec)
         │
         ▼  BUILD TIME
  Codegen
    ├──► NativeCalculatorSpec.java / .kt  (Android)
    └──► NativeCalculatorSpec.h / .mm     (iOS)
         │
         ▼  RUNTIME
  CalculatorModule.kt / Calculator.mm  (your implementation)
         │
         ▼
  TurboModuleRegistry (via JSI)
         │
         ▼
  JS accesses directly, no string lookup, no Bridge
```

Lazy loading: the module is only instantiated the first time JS requests it — lighter startup.

### The TurboModule in this project

- Spec: [src/specs/NativeCalculator.ts](src/specs/NativeCalculator.ts)
- Config: [`codegenConfig`](package.json) in package.json
- Android: [CalculatorModule.kt](android/app/src/main/java/com/rnarchdemo/calculator/CalculatorModule.kt), [CalculatorPackage.kt](android/app/src/main/java/com/rnarchdemo/calculator/CalculatorPackage.kt), registered in [MainApplication.kt](android/app/src/main/java/com/rnarchdemo/MainApplication.kt)
- iOS: [Calculator.h](ios/RNArchDemo/Calculator.h), [Calculator.mm](ios/RNArchDemo/Calculator.mm)

The "TurboModule" screen in the app exercises:
- `add(a,b)` — **synchronous**, returns `number` directly.
- `multiplyAsync(a,b)` — **asynchronous**, dispatches to another thread natively and resolves a Promise.
- `getConstants()` — constants from native, **lazy** (in old NativeModules they were sent eagerly on startup, increasing cold start time).

---

## Thread Model

At least three relevant threads run concurrently:

```
┌─────────────────────────────────────────────────────────────────┐
│                      THREADS IN PARALLEL                         │
├──────────────────┬──────────────────┬───────────────────────────┤
│   JS THREAD      │   UI THREAD      │   BACKGROUND THREAD       │
│                  │   (Main)         │   (Shadow)                │
│  • Your JS code  │  • 60fps frames  │  • Fabric C++             │
│  • React recon.  │  • Gestures      │  • Yoga layout            │
│  • Sync TurboMod │  • Native anims  │  • Commits                │
│                  │                  │                           │
│  If blocked:     │  If blocked:     │  If blocked:              │
│  setState pauses,│  App freezes     │  Layout delayed           │
│  callbacks stop  │  visually        │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
```

Practical points:
- **`useNativeDriver: true`** (Animated) runs the animation on the UI thread — it stays smooth even if JS is blocked. See the "Thread Model" screen in the app: the "Block JS for 2s" button demonstrates that the ball keeps moving.
- **Reanimated 3** goes further: runs JS "worklets" directly on the UI thread via JSI.
- **Synchronous TurboModules** run on the JS thread (no async queue). Good for cheap work; bad for heavy work.
- **Async TurboModules** can dispatch to Executors (Android) or GCD (iOS) and return via Promise.

---

## Hermes vs JSC

Hermes is the JavaScript engine created by Meta specifically for mobile. Before it, RN used **JavaScriptCore (JSC)** — the same engine as Safari.

```
                   JSC                       HERMES
                   ───                       ──────
JS parsing:        At runtime (on boot)      At build time (emits .hbc bytecode)
JIT:               Yes                       No (deliberate)
Startup:           Slower                    Faster
Memory:            Higher                    Lower
Predictable start: No (depends on JIT)       Yes (pre-compiled bytecode)
Debugging:         Chrome DevTools           Chrome DevTools + Flipper
Default in RN:     Up to 0.69               0.70+
```

**Why no JIT?**
JIT (Just-In-Time compilation) speeds up hot code after it runs a few times — great for long-running servers. On mobile apps, users often close the app before JIT has a chance to warm up. Hermes trades JIT for pre-compiled bytecode: the code arrives "warm" from the very first frame.

Hermes integrates with the New Architecture via JSI — all C++/JSI calls work transparently on top of it.

---

## Metro Bundler and Fast Refresh

**Metro** is React Native's JavaScript bundler (equivalent to Webpack/Vite in the web world). It runs in the background during development (`npm start`).

```
  Your .tsx/.ts files
         │
         ▼
  Metro Bundler
    ├── resolves imports
    ├── transpiles TypeScript → JS
    ├── applies Babel transforms
    └── produces JS bundle
         │
         ▼  DEV
  Local HTTP server  ──► app downloads bundle over the network
         │
         ▼  PROD
  Bundle packed into .apk / .ipa  (via Hermes: compiled to .hbc)
```

**Fast Refresh** is the mechanism that updates only the component you edited without losing the state of other components. It is different from the old "hot reload" (which restarted everything) and "live reload" (which also restarted).

How it works under the hood:
1. Metro detects a file change.
2. Sends only the updated module to the app via WebSocket.
3. The React runtime swaps the component in memory.
4. Local state of unedited components is preserved.

Limitation: if you edit a non-component module (utility, global state hook), Fast Refresh restarts the whole app to guarantee consistency.

---

## Concurrent React on mobile

React 18 introduced **concurrent mode** — the ability for React to pause and resume rendering work. On mobile, this matters because:

- **Transitions** (`useTransition`): mark an update as "non-urgent". React can interrupt its rendering if a more urgent update arrives (e.g. a user tap).
- **Suspense** (`<Suspense fallback={...}>`): wait for data without blocking the UI.
- **`startTransition`**: keeps the UI responsive while a heavy screen loads.

```
  Without concurrent mode:
    user types → React renders entire screen → UI freezes for 200ms

  With concurrent mode:
    user types → React starts rendering (low priority)
               → user types more → React PAUSES the previous render
               → processes new character (high priority)
               → resumes heavy render afterwards
```

Fabric was designed to support this: the **atomic commit** means a draft rendering can be discarded before ever reaching the UI thread — something impossible with the async Paper renderer of the old architecture.

---

## Reanimated 3 — JSI in practice

Reanimated 3 is the most visible demonstration of JSI's power in the real world. It lets you write JavaScript that runs directly on the **UI thread**, without going through the JS thread on every frame.

```
  Animation without Reanimated (JS Animated):
    UI thread renders frame ──► asks JS for value ──► waits ──► receives ──► renders
    (each frame crosses JSI/Bridge round-trip)

  Animation with Reanimated 3 (worklets):
    UI thread renders frame ──► executes worklet directly ──► renders
    (JS is out of the critical path)
```

**Worklets** are special JS functions marked with `'worklet'` that Reanimated copies to the UI thread via JSI. They have access to animated values (`useSharedValue`) but run in parallel to the normal JS thread.

```typescript
const offset = useSharedValue(0);

const animatedStyle = useAnimatedStyle(() => {
  'worklet'; // this function runs on the UI thread, not in JS
  return { transform: [{ translateX: offset.value }] };
});
```

This is what enables 120fps animations on ProMotion displays without consuming the JS thread — something impractical with the old architecture.

---

## Interop Layer — incremental migration

When the New Architecture was enabled by default in RN 0.76, the biggest concern was: "what about the hundreds of libraries still using the old Bridge?". The answer is the **Interop Layer**.

```
  New Architecture (Fabric + JSI)
         │
         ▼
  Interop Layer  ◄── compatibility shim
         │
         ▼
  Legacy library (uses Bridge / Paper / old NativeModules)
```

How it works:
- **For UI components**: Fabric has a compatibility mode that wraps old Paper components in a Fabric wrapper.
- **For native modules**: the TurboModuleRegistry can access legacy NativeModules as if they were TurboModules (with a performance cost, but without breaking).

This lets large apps migrate like this:
1. Enable New Architecture (RN 0.76+).
2. App keeps working — legacy libraries run via interop.
3. Over time, replace them with New Architecture-native versions.
4. Remove the interop layer when no longer needed.

The interop cost is real: you pay part of the Bridge overhead where it is still active. But it is far better than a big-bang rewrite.

---

## Tradeoffs

### Gains
- Better perceived performance (startup, animations, layout).
- End-to-end typed contracts.
- More predictable and debuggable pipeline (atomic Fabric commits).
- Enables advanced React features (Suspense, transitions) to work correctly.

### Costs
- **Build complexity**: codegen, Pods, gradle plugins, more moving parts.
- **Learning curve**: requires understanding Shadow Tree, JSI, C++/Obj-C++ for more sophisticated modules.
- **Compatibility**: older libraries may need interop wrappers (the New Architecture keeps compatibility via the *interop layer*, but at a cost).
- **Native debugging is more "C++"**: stack traces traverse additional layers.
- **Tooling still maturing** in some areas (some test mocks, some legacy libraries).

### When the trade is worth it
For new apps from 2025 onward, it is the default path — there is no real benefit in starting with the old architecture. For large production apps, migration is usually incremental: enable Fabric, migrate critical modules to TurboModules, rely on interop for the rest.

---

## Ecosystem alternatives

Do not confuse "alternative to Fabric" with "alternative to React Native". The main options outside RN:

| Solution                    | Model                                          | When it makes sense                           |
| --------------------------- | ---------------------------------------------- | --------------------------------------------- |
| **Flutter**                 | Own UI (Skia/Impeller), Dart                   | Maximum visual control, non-React team        |
| **Native (Swift/Kotlin)**   | Pure native UI                                 | Platform-specific app, strong native team     |
| **Kotlin Multiplatform**    | Shared logic, native UI                        | Share only business logic, native UI per OS   |
| **Capacitor / Ionic**       | WebView with native bridges                    | Reuse web app, performance is secondary       |
| **NativeScript**            | Native UI via JS, without React                | JS stack without committing to React          |
| **Tauri Mobile**            | WebView + Rust backend (beta)                  | Rust team, simple app                         |

Within the React Native world:
- **Expo** — toolchain on top of RN; supports New Architecture via dev client from SDK 51.
- **Brownfield integration** — RN embedded in existing native apps, simplified by the New Architecture.
- **React Native Skia / Reanimated / Gesture Handler** — libraries that leverage JSI/Fabric directly.

---

## Full flow: tap → setState

This is the most useful mental exercise to internalize everything. When the user taps a button that calls `setState`, what happens step by step:

```
  USER TAPS THE SCREEN
         │
         ▼
  [UI THREAD] OS detects the touch
         │
         ▼
  [UI THREAD] RN gesture responder processes the event
         │
         ▼  via JSI (New Arch) or serialized Bridge (old)
  [JS THREAD] Your onPress() handler is called
         │
         ▼
  [JS THREAD] setState({ counter: counter + 1 })
         │
         ▼
  [JS THREAD] React schedules a re-render
              (concurrent mode: can be interrupted if something
               more urgent arrives)
         │
         ▼
  [JS THREAD] React reconciles — diffs the component tree
         │
         ▼
  [BACKGROUND] Fabric receives Shadow Tree mutations (via JSI)
         │
         ▼
  [BACKGROUND] Yoga recalculates layout if needed
         │
         ▼
  [BACKGROUND] Commit: an immutable snapshot of the new UI is created
         │
         ▼
  [UI THREAD] Mount: commit is applied
              ├── existing UIViews are updated
              ├── new UIViews are created
              └── removed UIViews are destroyed
         │
         ▼
  NEXT FRAME IS RENDERED WITH THE NEW STATE
```

In the **old architecture**, every arrow crossing threads went through the Bridge with JSON serialization. In the **New Architecture**, arrows crossing JS ↔ native go through JSI with no copy.

---

## Suggested study roadmap

### Phase 1 — RN fundamentals (before going deep on architecture)

1. How the **Metro Bundler** works and what it produces.
2. Lifecycle of RN components vs web React components — what is different.
3. **StyleSheet and Yoga** — how RN layout differs from CSS.
4. Create a **simple NativeModule** in the old architecture (just to feel the problem TurboModules solve).

### Phase 2 — New Architecture

5. **JSI** — what it is, why it is foundational.
6. **Hermes** — how the engine affects startup and memory.
7. **Fabric** — Shadow Tree, Yoga, phases (render/commit/mount).
8. **TurboModules + Codegen** — build one from scratch (like the `Calculator` in this project).
9. **Thread model** — intentionally block the JS thread (Threading screen in the app).

### Phase 3 — JSI in practice and migration

10. **Reanimated 3** — worklets, useSharedValue, useAnimatedStyle.
11. **Concurrent React** — useTransition, Suspense on mobile.
12. **Interop Layer** — how large apps migrate incrementally.

### Exercises for those who need to explain it

- Draw the full "tap → setState" flow diagram from memory.
- Explain the difference between Bridge and JSI to someone using an everyday analogy.
- Create a second TurboModule (`getDeviceName` or `divideAsync` with rejection).
- Replace the `Animated` in the Threading screen with Reanimated 3.

---

## References

Official / canonical:
- [New Architecture — overview](https://reactnative.dev/architecture/landing-page)
- [TurboModules — introduction](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [Fabric — renderer](https://reactnative.dev/architecture/fabric-renderer)
- [JSI — technical explanation](https://reactnative.dev/architecture/glossary#javascript-interfaces-jsi)
- [Codegen for TurboModules](https://reactnative.dev/docs/the-new-architecture/using-codegen)
- [Hermes](https://reactnative.dev/docs/hermes)
- [Metro Bundler](https://metrobundler.dev)

Further reading:
- Official React Native blog posts for each release (0.68→0.85).
- [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/) — real-world JSI/UI thread usage.
- [Expo + New Architecture](https://docs.expo.dev/guides/new-architecture/).
- Talks from React Conf and App.js Conf — great for building the right mental model.

---

## Project structure

```
.
├── App.tsx                       # minimal useState router between screens
├── src/
│   ├── components/               # InfoCard, ScreenHeader
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── FabricDemoScreen.tsx
│   │   ├── TurboModuleDemoScreen.tsx
│   │   └── ThreadingDemoScreen.tsx
│   └── specs/
│       └── NativeCalculator.ts   # TurboModule spec (codegen source of truth)
├── android/app/src/main/java/com/rnarchdemo/
│   ├── MainApplication.kt        # registers CalculatorPackage
│   └── calculator/
│       ├── CalculatorModule.kt   # implements generated NativeCalculatorSpec
│       └── CalculatorPackage.kt  # lazy BaseReactPackage
├── ios/RNArchDemo/
│   ├── AppDelegate.swift
│   ├── Calculator.h              # adopts generated NativeCalculatorSpec
│   └── Calculator.mm             # Obj-C++ implementation
└── package.json                  # codegenConfig points to src/specs
```
