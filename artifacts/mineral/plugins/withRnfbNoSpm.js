// Config plugin: opt react-native-firebase out of SPM-based Firebase
// resolution by prepending `$RNFirebaseDisableSPM = true` to the generated
// ios/Podfile, before any target block. Without this, RNFB's SPM mode keeps
// Firebase inside the pod targets and the app target never links
// FirebaseCore (link failure: _OBJC_CLASS_$_FIRApp).
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const LINE = "$RNFirebaseDisableSPM = true";

module.exports = function withRnfbNoSpm(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf8");
      if (!contents.includes(LINE)) {
        fs.writeFileSync(podfilePath, `${LINE}\n${contents}`);
      }
      return cfg;
    },
  ]);
};
