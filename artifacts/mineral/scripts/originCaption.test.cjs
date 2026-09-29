// Synthetic render of the real Origin screen and date sheet, without a device
// or Firebase. Run: node --test scripts/originCaption.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const jsx = (type, props) => ({ type, props: props || {} });
const styles = { create: (value) => value, absoluteFillObject: {}, absoluteFill: {}, hairlineWidth: 0.5 };
const spiral = execute("lib/spiral.ts", () => {
  throw new Error("spiral has no runtime imports");
});

function execute(file, requireMock) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: requireMock, console, Date,
  }, { filename: file });
  return module.exports;
}

function descendants(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...[node.props?.children].flat().flatMap(descendants)];
}

test("native metadata line alone opens the bounded spinner; only date words have the muted hairline", () => {
  const birthDate = new Date(1990, 0, 1);
  const hooks = [];
  let stateCursor = 0;
  let refCursor = 0;
  let currentTree;
  let wanderingSetter;
  const React = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      // The ninth useState in OriginScreen is wandering (the first eight
      // include useEasedValue's internal state). Assert its role below.
      if (index === 8) wanderingSetter = (value) => {
        hooks[index] = typeof value === "function" ? value(hooks[index]) : value;
      };
      return [hooks[index], (value) => {
        hooks[index] = typeof value === "function" ? value(hooks[index]) : value;
      }];
    },
    useRef(initial) {
      const index = refCursor++;
      if (!React.refs[index]) React.refs[index] = { current: initial };
      return React.refs[index];
    },
    refs: [],
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect() {},
  };
  const chain = new Proxy({}, { get: () => () => chain });
  const noop = () => null;
  const Value = class {
    interpolate() { return 1; }
    setValue() {}
  };
  const Animated = {
    Value, View: "Animated.View",
    timing: () => ({ start() {} }), loop: () => ({ start() {} }),
    sequence() {}, add() {},
  };
  const sheets = {
    OriginDatePickerSheet: "OriginDatePickerSheet",
    ReadingSheet: noop, CompanionsSheet: noop, MapTeachingSheet: noop, QuietToast: noop,
  };
  const requireMock = (name) => {
    if (name === "react") return { ...React, default: React };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (name === "react-native") return {
      Animated, Easing: new Proxy({}, { get: () => () => {} }),
      Platform: { OS: "ios" }, Pressable: "Pressable", Text: "Text", View: "View",
      StyleSheet: styles,
    };
    if (name === "react-native-gesture-handler") return {
      Gesture: new Proxy({}, { get: () => () => chain }), GestureDetector: "GestureDetector",
    };
    if (name === "react-native-safe-area-context") return {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    };
    if (name === "expo-router") return { useFocusEffect() {}, router: {} };
    if (name === "@/lib/spiral") return spiral;
    if (name === "@/constants/colors") return { default: { light: { textTertiary: "#aabbcc" } } };
    if (name === "@/constants/typography") return {
      TypeScale: { serifTitle: { fontFamily: "serif", fontSize: 26 },
        metadata: { fontFamily: "sans", fontSize: 11, fontWeight: "normal" } },
    };
    if (name === "@/context/AuthContext") return { useAuth: () => ({ user: null }) };
    if (name === "@/context/UserContext") return {
      useUser: () => ({ profile: { birthDate: { toDate: () => birthDate } }, updateProfile: noop }),
    };
    if (name === "@/components/OriginSheets") return sheets;
    if (name === "@/components/SpiralComponents") return { OriginMap: noop, TurnWheel: noop };
    if (name === "@/components/Links") return { LinkWhisper: noop };
    if (name === "@/components/Atmosphere") return { OriginAtmosphere: noop };
    if (name === "@/components/CaptureSheet") return { CaptureSheet: noop };
    if (name === "@/components/Cta") return { default: noop };
    if ([
      "@react-native-async-storage/async-storage", "expo-haptics", "firebase/firestore",
      "@/lib/firestore", "@/lib/firebase", "@/lib/encounter", "@/lib/visitStore",
    ].includes(name)) return {};
    throw new Error(`Unexpected import: ${name}`);
  };
  const OriginScreen = execute("app/(tabs)/origin.tsx", requireMock).default;
  function render() {
    stateCursor = 0;
    refCursor = 0;
    currentTree = OriginScreen();
    return descendants(currentTree);
  }

  let nodes = render();
  assert.equal(typeof wanderingSetter, "function");
  wanderingSetter(true);
  nodes = render();
  const metadata = nodes.find((node) => node.props?.testID === "origin-wander-date");
  assert.equal(metadata.type, "Pressable");
  assert.equal(metadata.props.style.width, "100%");
  assert.equal(metadata.props.style.minHeight, 44);
  assert.equal(metadata.props.disabled, undefined);
  const wrapper = nodes.find((node) =>
    node.type === "View" && node.props?.style?.[0]?.justifyContent === "center" &&
    descendants(node).includes(metadata));
  assert.equal(wrapper.props.pointerEvents, "auto");
  const season = descendants(wrapper).find((node) =>
    node.type === "Text" && node.props?.style?.fontFamily === "serif");
  assert.ok(season, "season remains outside the metadata press target");
  assert.ok(!descendants(metadata).includes(season));
  const texts = descendants(metadata).filter((node) => node.type === "Text");
  assert.equal(texts.length, 2);
  const [date, remainder] = texts;
  assert.match(date.props.children, /^[A-Z][a-z]+ \d{4}$/);
  assert.match(remainder.props.children, /^ · age .* · cycle .* · year /);
  assert.equal(date.props.style[1].borderBottomWidth, styles.hairlineWidth);
  assert.equal(date.props.style[1].borderBottomColor, date.props.style[0].color);
  assert.equal(remainder.props.style.color, date.props.style[0].color);
  assert.equal(remainder.props.style.fontWeight, date.props.style[0].fontWeight);
  assert.equal(remainder.props.style.borderBottomWidth, undefined);
  assert.equal(metadata.props.children.props.style.flexWrap, "wrap");
  assert.equal(nodes.find((node) => node.type === "OriginDatePickerSheet").props.open, false);

  metadata.props.onPress();
  nodes = render();
  const mountedSheet = nodes.find((node) => node.type === "OriginDatePickerSheet");
  assert.equal(mountedSheet.props.open, true);
  assert.ok(mountedSheet.props.value >= mountedSheet.props.minimumDate);
  assert.ok(mountedSheet.props.value <= mountedSheet.props.maximumDate);
  mountedSheet.props.onClose();
  assert.equal(render().find((node) => node.type === "OriginDatePickerSheet").props.open, false);

  // Render the actual native sheet component too, with the spinner child.
  const sheetRequire = (name) => {
    if (name === "react") return { ...React, default: React };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (name === "react-native") return {
      ...requireMock(name), Platform: { OS: "ios" }, Dimensions: { get: () => ({ height: 800 }) },
      Keyboard: {}, Modal: "Modal", PanResponder: {}, ScrollView: "ScrollView",
    };
    if (name === "@react-native-community/datetimepicker") return { default: "DateTimePicker" };
    if (name === "@/components/Links") return { LinkWhisper: noop };
    return requireMock(name);
  };
  const actualSheet = execute("components/OriginSheets.tsx", sheetRequire).OriginDatePickerSheet;
  const shell = actualSheet(mountedSheet.props);
  assert.equal(shell.props.open, true);
  const spinner = descendants(shell).find((node) => node.type === "DateTimePicker");
  assert.equal(spinner.props.display, "spinner");
  assert.equal(spinner.props.minimumDate, mountedSheet.props.minimumDate);
  assert.equal(spinner.props.maximumDate, mountedSheet.props.maximumDate);
});