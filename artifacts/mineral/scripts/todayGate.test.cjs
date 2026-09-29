// Synthetic component harness: execute the actual Today screen, with no Firebase
// connection or user documents. Run: node --test scripts/todayGate.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../app/(tabs)/index.tsx"),
  "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness() {
  let clock = new Date(2026, 5, 10, 23, 59, 59).getTime();
  class ClockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() { return clock; }
  }
  let doc;
  let previous;
  let nextTimer = 0;
  let renders = 0;
  let builds = 0;
  let pushes = 0;
  let foreground;
  const timers = new Map();
  const hooks = [];
  let cursor = 0;
  let pending = false;
  const jsx = (type, props) => ({ type, props: props || {} });
  const BeginButton = () => null;
  const React = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial;
      return [hooks[i], (value) => {
        const updated = typeof value === "function" ? value(hooks[i]) : value;
        if (!Object.is(updated, hooks[i])) {
          hooks[i] = updated;
          pending = true;
        }
      }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = { current: initial };
      return hooks[i];
    },
    useEffect(effect, deps) {
      const i = cursor++;
      const old = hooks[i];
      if (old && deps.every((dep, j) => Object.is(dep, old.deps[j]))) return;
      old?.cleanup?.();
      hooks[i] = { deps, cleanup: effect() };
    },
    useCallback(fn) { return fn; },
  };
  const Animated = {
    Value: class {
      interpolate() { return ""; }
    },
    timing() { return { start() {} }; },
  };
  const requireMock = (name) => {
    if (name === "react") return { ...React, default: React };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "expo-router") return {
      router: { push() { pushes++; }, navigate() {} },
      useFocusEffect() {},
    };
    if (name === "react-native") return {
      Animated, AppState: { addEventListener(_event, callback) {
        foreground = callback;
        return { remove() { foreground = undefined; } };
      } },
      Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View",
      StyleSheet: { create: (v) => v, absoluteFillObject: {} },
    };
    if (name === "react-native-safe-area-context") return {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    };
    if (name === "firebase/firestore") return {
      onSnapshot(_ref, callback) {
        previous = callback;
        callback({ data: () => doc });
        return () => { previous = undefined; };
      },
    };
    if (name === "@/context/AuthContext") return { useAuth: () => ({ user: { uid: "synthetic" } }) };
    if (name === "@/context/UserContext") return { useUser: () => ({ profile: { sequenceDay: 2 } }) };
    if (name === "@/lib/firestore") return {
      fetchEncounterLibrary: async () => [{ id: "synthetic-encounter", phase: "signal" }],
      selectEncounterForDay: (_library, day) => ({ id: `day-${day}`, phase: "signal" }),
      getUserEncounter: async () => doc,
      userEncounterRef: () => ({}),
      recordVisit: async () => {},
    };
    if (name === "@/lib/encounter") return {
      buildEncounterSession: async () => { builds++; return {}; },
      encounterRouteParams: () => ({}),
      setEncounterSession() {},
    };
    if (name === "@/lib/spiral") return {
      PHASE_ACCENT: { signal: "#fff" },
      dayInTurn: () => 1, practiceTurnOf: () => 1, word: () => "one",
    };
    if (name === "@/lib/visitStore") return { consumeVisitDay: () => null };
    if (name === "@/constants/typography") return { TypeScale: { navGlyph: {}, micro: {}, serifTitle: {}, serifSmall: {} } };
    if (name === "@/components/BeginButton") return { default: BeginButton };
    if (name.startsWith("@/components/")) return new Proxy({}, {
      get: () => () => null,
    });
    throw new Error(`Unexpected import: ${name}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: requireMock, Date: ClockDate,
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    console,
  });
  const Today = module.exports.default;
  let tree;
  function render() {
    do {
      pending = false;
      cursor = 0;
      renders++;
      tree = Today();
      assert.ok(renders < 50, "render loop");
    } while (pending);
  }
  const find = (node, predicate) => {
    if (!node || typeof node !== "object") return;
    if (predicate(node)) return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const match = find(child, predicate);
      if (match) return match;
    }
  };
  return {
    async ready() { render(); await Promise.resolve(); render(); },
    setDoc(value) { doc = value; previous?.({ data: () => doc }); render(); },
    setReadDoc(value) { doc = value; },
    advanceTo(value) { clock = new Date(value).getTime(); },
    active() { foreground("active"); render(); },
    get suspendedMidnightTimer() { return [...timers.values()].some((timer) => timer.ms <= 2000); },
    get gated() { return !!find(tree, (node) => node.props?.testID === "threshold-gated"); },
    async begin() {
      const button = find(tree, (node) => node.type === BeginButton);
      assert.ok(button, "Begin button present");
      await button.props.onPress();
      render();
    },
    get builds() { return builds; },
    get pushes() { return pushes; },
  };
}

test("missing completedAt never gates snapshot or begin preflight", async () => {
  const screen = harness();
  await screen.ready();
  screen.setDoc({ status: "completed", completedAt: null });
  assert.equal(screen.gated, false);
  screen.setDoc({ status: "completed" });
  assert.equal(screen.gated, false);
  await screen.begin();
  assert.equal(screen.builds, 1);
  assert.equal(screen.pushes, 1);
});

test("dated completion gates both snapshot and fresh begin preflight", async () => {
  const screen = harness();
  await screen.ready();
  const completedAt = { toDate: () => new Date(2026, 5, 10, 12) };
  screen.setDoc({ status: "completed", completedAt });
  assert.equal(screen.gated, true);
  screen.setDoc(undefined); // snapshot is late, so Begin is still visible
  assert.equal(screen.gated, false);
  screen.setReadDoc({ status: "completed", completedAt }); // preflight read only
  await screen.begin();
  assert.equal(screen.gated, true);
  assert.equal(screen.builds, 0);
  assert.equal(screen.pushes, 0);
});

test("suspended midnight timer then active event reopens gate from current date", async () => {
  const screen = harness();
  await screen.ready();
  screen.setDoc({
    status: "completed",
    completedAt: { toDate: () => new Date(2026, 5, 10, 12) },
  });
  assert.equal(screen.gated, true);
  assert.equal(screen.suspendedMidnightTimer, true);
  screen.advanceTo("2026-06-11T12:00:00");
  // Deliberately do not fire the scheduled timer, as when JS is suspended.
  screen.active();
  assert.equal(screen.gated, false);
  await screen.begin();
  assert.equal(screen.builds, 1);
});