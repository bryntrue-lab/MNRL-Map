// Executes real screen/component functions and their handlers with isolated
// native/Firebase boundaries. No accounts, writes, microphone, or server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, requireMock, suffix = "") {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const compiled = ts.transpileModule(source + suffix, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics.length, 0);
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module, exports: module.exports, require: requireMock, console,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  });
  return module.exports;
}

function componentHarness(file, { imports = {}, exportName = "default", suffix = "" } = {}) {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let pending = false;
  let tree;
  let props;
  const React = {
    useState(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial;
      return [hooks[i], (value) => {
        const next = typeof value === "function" ? value(hooks[i]) : value;
        if (!Object.is(next, hooks[i])) { hooks[i] = next; pending = true; }
      }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = { current: initial };
      return hooks[i];
    },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = cursor++;
      const old = hooks[i];
      if (old && deps?.every((value, j) => Object.is(value, old.deps[j]))) return;
      hooks[i] = { deps };
      effects.push(fn);
    },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const native = {
    Platform: { OS: "ios" }, View: "View", Text: "Text", Pressable: "Pressable",
    TextInput: "TextInput", ScrollView: "ScrollView",
    Dimensions: { get: () => ({ height: 874, width: 402 }) },
    StyleSheet: { create: (styles) => styles },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Animated: {
      View: "Animated.View", Text: "Animated.Text",
      Value: class { interpolate() { return 1; } setValue() {} },
      timing: () => ({ start() {} }),
    },
  };
  const requireMock = (name) => {
    if (name in imports) return imports[name];
    if (name === "react") return { ...React, default: React };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react-native") return native;
    if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
    if (name === "react-native-svg") return { default: "Svg", Circle: "Circle", Path: "Path" };
    if (name === "@react-native-async-storage/async-storage") return { default: {
      getItem: async () => "1", setItem: async () => {},
    } };
    if (name === "@/constants/typography") return load("constants/typography.ts", () => {
      throw new Error("unexpected typography import");
    });
    if (name === "@/constants/colors") return { default: { light: { textSecondary: "#aaa", textMuted: "#777" } } };
    if (name === "@/lib/firebase") return { db: {}, functions: {} };
    if (name.startsWith("@/components/")) return new Proxy({}, { get: (_target, key) => String(key) });
    throw new Error(`Unexpected boundary: ${name}`);
  };
  const Component = load(file, requireMock, suffix)[exportName];
  return {
    render(nextProps = props) {
      props = nextProps;
      let count = 0;
      do {
        pending = false;
        cursor = 0;
        effects = [];
        tree = Component(props);
        for (const effect of effects) effect();
        assert.ok(++count < 30, "render loop");
      } while (pending);
      return tree;
    },
    find(id) { return find(tree, (node) => node.props.testID === id); },
    type(name) { return find(tree, (node) => node.type === name); },
    get tree() { return tree; },
  };
}

function find(node, predicate) {
  if (!node || typeof node !== "object") return;
  if (node.props && predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const children = node.props?.children;
  return (Array.isArray(children) ? children : [children]).map(text).join("");
}
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function encounter({ offered = false, mode = "sequence", lookup } = {}) {
  const routes = [];
  const completions = [];
  let offerReads = 0;
  const h = componentHarness("app/encounter.tsx", {
    exportName: "EncounterFlow", suffix: "\nexport { EncounterFlow };",
    imports: {
      "expo-router": { router: { replace: (route) => routes.push(route) } },
      "expo-audio": {
        RecordingPresets: { HIGH_QUALITY: {} },
        useAudioPlayer: () => ({}), useAudioPlayerStatus: () => ({}),
        useAudioRecorder: () => ({}), useAudioRecorderState: () => ({}),
        setAudioModeAsync: async () => {},
      },
      "firebase/firestore": { doc: () => ({}), getDoc: async () => ({ exists: () => false }) },
      "@/context/AuthContext": { useAuth: () => ({ user: { uid: "isolated", isAnonymous: true } }) },
      "@/context/UserContext": { useUser: () => ({ profile: { sequenceDay: 3, keepThisOffered: true } }) },
      "@/lib/notifications": { wasMorningCallOffered: () => {
        offerReads++;
        return lookup ? lookup() : Promise.resolve(offered);
      } },
      "@/lib/encounter": {
        crystallizingPrompt: () => null,
        renderablePostBlocks: () => ({ blocks: [], skipped: [] }),
        warmUpPrompts: () => [],
      },
      "@/lib/encounterAudio": {},
      "@/lib/firestore": {
        userEncounterId: () => "encounter--1",
        completeEncounter: (...args) => { completions.push(args); return Promise.resolve(); },
      },
      "@/lib/spiral": { PHASE_ACCENT: { signal: "#fff" } },
    },
  });
  h.render({ uid: "isolated", session: {
    encounter: { id: "encounter", phase: "signal", blocks: [], subtitle: "close" },
    turn: 1, mode, audioUrl: null, resume: { blockIndex: 1 },
  } });
  return { h, routes, completions, reads: () => offerReads };
}

test("close copy and charge metadata; save completes once and bypasses morning-call", async () => {
  const { h, routes, completions, reads } = encounter();
  await tick();
  assert.equal(h.find("close-return").props.label, "return to the map →");
  const whisper = h.find("close-to-guide");
  assert.equal(whisper.props.label, "or ask where today's charge is — speak it");
  whisper.props.onPress();
  whisper.props.onPress();
  // Use the stale map handler before a rerender: a state-only guard fails here.
  await h.find("close-return").props.onPress();
  assert.equal(completions.length, 0);
  h.render();
  const sheet = h.type("CaptureSheet").props;
  assert.equal(sheet.open, true);
  assert.equal(sheet.source, "spontaneous");
  assert.equal(sheet.encounterRef, null);
  assert.equal(sheet.lockedType, null);
  assert.equal(sheet.mapRef, null);
  const before = reads();
  sheet.onSaved();
  sheet.onClose(); // actual CaptureSheet calls both, in this order
  sheet.onSaved();
  await h.find("close-return").props.onPress();
  whisper.props.onPress();
  assert.equal(reads(), before, "save must not inspect/consume the offer");
  assert.deepEqual(routes, ["/(tabs)/guide"]);
  assert.deepEqual(completions, [["isolated", "encounter", 1, 3]]);
  h.render();
  assert.equal(h.type("CaptureSheet").props.open, false);
});

test("unsaved charge dismissal restores map close and first-close morning-call offer", async () => {
  const { h, routes, completions } = encounter();
  h.find("close-to-guide").props.onPress();
  h.render();
  h.type("CaptureSheet").props.onClose();
  h.render();
  assert.equal(h.type("CaptureSheet").props.open, false);
  await h.find("close-return").props.onPress({ nativeEvent: {} });
  assert.deepEqual(routes, ["/morning-call"]);
  assert.equal(completions.length, 1);
});

test("map-first rapid cross-link presses cannot open charge or complete twice", async () => {
  const gate = deferred();
  const { h, routes, completions } = encounter({ lookup: () => gate.promise });
  const primary = h.find("close-return");
  const whisper = h.find("close-to-guide");
  const first = primary.props.onPress();
  whisper.props.onPress();
  await primary.props.onPress();
  h.render();
  assert.equal(h.type("CaptureSheet").props.open, false);
  assert.equal(completions.length, 1);
  gate.resolve(false);
  await first;
  assert.deepEqual(routes, ["/morning-call"]);
});

test("ordinary offered map close and visit paths retain their original behavior", async () => {
  const normal = encounter({ offered: true });
  await normal.h.find("close-return").props.onPress();
  assert.deepEqual(normal.routes, ["/(tabs)/origin"]);
  assert.equal(normal.completions.length, 1);
  const visit = encounter({ mode: "visit" });
  visit.h.find("close-to-guide").props.onPress();
  visit.h.render();
  visit.h.type("CaptureSheet").props.onSaved();
  assert.deepEqual(visit.routes, ["/(tabs)/guide"]);
  assert.equal(visit.completions.length, 0);
});

test("real CaptureSheet keep excludes duplicate writes and every dismissal until save settles", async () => {
  const write = deferred();
  const writes = [];
  const callbacks = [];
  const h = componentHarness("components/CaptureSheet.tsx", {
    exportName: "CaptureSheet",
    imports: { "@/lib/firestore": { createFieldNote: (...args) => {
      writes.push(args); return write.promise;
    } } },
  });
  h.render({ open: true, uid: "isolated", source: "spontaneous", encounterRef: null,
    atmosphere: "signal", bottomPad: 0, onSaved: () => callbacks.push("saved"),
    onClose: () => callbacks.push("closed") });
  h.find("capture-chip-spark").props.onPress();
  h.render();
  h.find("capture-input").props.onChangeText("  today's charge  ");
  h.render();
  const keep = h.find("capture-keep").props.onPress;
  const first = keep();
  await keep();
  h.find("capture-close").props.onPress();
  h.type("SheetShell").props.onClose(); // includes swipe/backdrop dismissal
  assert.deepEqual(callbacks, []);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "isolated");
  assert.equal(writes[0][1].content, "today's charge");
  assert.equal(writes[0][1].type, "spark");
  assert.equal(writes[0][1].source, "spontaneous");
  assert.equal(writes[0][1].encounterRef, undefined);
  assert.equal(writes[0][1].captureMode, "text");
  assert.equal(writes[0][1].mapRef, null);
  write.resolve("note");
  await first;
  await keep();
  assert.deepEqual(callbacks, ["saved", "closed"]);
  assert.equal(writes.length, 1);
});

test("failed CaptureSheet write releases save/dismiss guard without reporting saved", async () => {
  const write = deferred();
  let saved = 0, closed = 0;
  const h = componentHarness("components/CaptureSheet.tsx", {
    exportName: "CaptureSheet",
    imports: { "@/lib/firestore": { createFieldNote: () => write.promise } },
  });
  h.render({ open: true, uid: "isolated", source: "spontaneous", initialType: "spark",
    atmosphere: "signal", bottomPad: 0, onSaved: () => saved++, onClose: () => closed++ });
  h.find("capture-input").props.onChangeText("charge");
  h.render();
  const first = h.find("capture-keep").props.onPress();
  write.reject(new Error("isolated write failure"));
  await first;
  h.find("capture-close").props.onPress();
  assert.equal(saved, 0);
  assert.equal(closed, 1);
});

test("charge screen plus real CaptureSheet: pending save blocks map, then one Guide completion", async () => {
  const screen = encounter();
  screen.h.find("close-to-guide").props.onPress();
  screen.h.render();
  const write = deferred();
  let writes = 0;
  const capture = componentHarness("components/CaptureSheet.tsx", {
    exportName: "CaptureSheet",
    imports: { "@/lib/firestore": { createFieldNote: () => {
      writes++;
      return write.promise;
    } } },
  });
  capture.render(screen.h.type("CaptureSheet").props);
  capture.find("capture-chip-resistance").props.onPress();
  capture.render();
  capture.find("capture-input").props.onChangeText("charge");
  capture.render();
  const first = capture.find("capture-keep").props.onPress();
  await capture.find("capture-keep").props.onPress();
  capture.find("capture-close").props.onPress();
  await screen.h.find("close-return").props.onPress();
  assert.equal(screen.completions.length, 0);
  assert.deepEqual(screen.routes, []);
  write.resolve("note");
  await first;
  await screen.h.find("close-return").props.onPress();
  assert.equal(writes, 1);
  assert.equal(screen.completions.length, 1);
  assert.deepEqual(screen.routes, ["/(tabs)/guide"]);
  // The offer is still available on the next ordinary close.
  const later = encounter();
  await later.h.find("close-return").props.onPress();
  assert.deepEqual(later.routes, ["/morning-call"]);
});

const fieldGates = load("lib/fieldNotesState.ts", () => { throw new Error("unexpected import"); });
const patternText = load("lib/patternText.ts", () => { throw new Error("unexpected import"); });

function guide(count, enabled, kept) {
  const notes = Array.from({ length: count }, (_, i) => ({ id: `note-${i}`, type: "spark" }));
  const h = componentHarness("app/(tabs)/guide.tsx", { imports: {
    "expo-router": { router: {} },
    "firebase/firestore": {
      doc: () => ({}), getDoc: async () => ({ exists: () => false }),
      onSnapshot: (_query, callback) => {
        callback({ docs: notes.map((note) => ({ id: note.id, data: () => note })) });
        return () => {};
      },
    },
    "firebase/functions": {},
    "@/context/AuthContext": { useAuth: () => ({ user: guideUser }) },
    "@/context/UserContext": { useUser: () => ({ profile: guideProfile }) },
    "@/lib/fieldPassages": { firstApprovedFieldPassage: () => null },
    "@/lib/fieldNotesState": fieldGates,
    "@/lib/firestore": { fieldNotesQuery: () => ({}) },
    "@/lib/patternEvidence": { subscribePatternDocuments: (_uid, callback) => {
      callback({}); return () => {};
    } },
    "@/lib/patternText": patternText,
  } });
  // Stable identities match context values and avoid resubscription render loops.
  const guideUser = { uid: "isolated", isAnonymous: !kept, email: kept ? "isolated@example.test" : null };
  const guideProfile = { readingsEnabled: enabled };
  h.render();
  return h;
}

test("Guide footer exact derived held-lines, serif pairing, canonical order and real door handlers", () => {
  const h = guide(15, true, true);
  const reading = h.find("guide-reading-link");
  const letter = h.find("guide-letter-link");
  assert.equal(reading.props.label, "a reflection →");
  assert.equal(letter.props.label, "request a letter →");
  const readingDoor = find(h.tree, (node) => node.type === "View" &&
    text(node).includes("fifteen notes, held together in one reading.") &&
    node.props.style?.alignItems === "center");
  const letterDoor = find(h.tree, (node) => node.type === "View" &&
    text(node) === "written by a person, to your field alone.");
  assert.ok(readingDoor);
  assert.ok(letterDoor);
  assert.equal(text(readingDoor), "fifteen notes, held together in one reading.");
  assert.equal(readingDoor.props.children[1].props.style.textAlign, "center");
  assert.equal(readingDoor.props.children[1].props.style.fontFamily, "CormorantGaramond_500Medium_Italic");
  assert.equal(letterDoor.props.children[1].props.style.color, "#aaa");
  const rendered = h.type("ScrollView").props.children;
  assert.ok(rendered.indexOf(readingDoor) < rendered.indexOf(letterDoor));
  reading.props.onPress();
  h.render();
  assert.equal(h.type("FieldReadingSheet").props.open, true);
  letter.props.onPress();
  h.render();
  assert.equal(h.type("FieldLetterSheet").props.open, true);
});

test("Guide held-lines follow actual gates: reflection >=7 + flag; letter >=15 + kept email", () => {
  for (const [count, enabled, kept, reflection, letter] of [
    [6, true, true, false, false], [7, true, false, true, false],
    [14, true, true, true, false], [15, false, true, false, true],
    [15, true, false, true, false],
  ]) {
    const h = guide(count, enabled, kept);
    assert.equal(!!h.find("guide-reading-link"), reflection);
    assert.equal(!!h.find("guide-letter-link"), letter);
    assert.equal(text(h.tree).includes("notes, held together in one reading."), reflection);
    assert.equal(text(h.tree).includes("written by a person, to your field alone."), letter);
    assert.ok(h.find("guide-about-link"));
  }
});