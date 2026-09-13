"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { assertBuildProfile } = require("./guard-build-profile");
const { selectAppConfig } = require("./select-app-config");

const APP_DIRECTORY = path.resolve(__dirname, "..");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(APP_DIRECTORY, fileName), "utf8"));
}

function makeTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mineral-static-config-"));
}

function removeTempDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function writeIdentityConfig(directory, identity) {
  fs.writeFileSync(
    path.join(directory, "app.json"),
    JSON.stringify({
      expo: {
        name: identity.displayName,
        scheme: identity.scheme,
        ios: {
          bundleIdentifier: identity.bundleIdentifier,
          googleServicesFile: identity.googleServicesFile,
        },
      },
    }),
  );
}

test("the checked-in production app.json is an exact static snapshot", () => {
  const active = fs.readFileSync(path.join(APP_DIRECTORY, "app.json"), "utf8");
  const production = fs.readFileSync(
    path.join(APP_DIRECTORY, "app.production.json"),
    "utf8",
  );

  assert.equal(active, production);
});

test("development changes only the explicitly approved app identity fields", () => {
  const production = readJson("app.production.json");
  const development = readJson("app.development.json");
  const normalizedDevelopment = structuredClone(development);

  normalizedDevelopment.expo.name = production.expo.name;
  normalizedDevelopment.expo.scheme = production.expo.scheme;
  normalizedDevelopment.expo.ios.bundleIdentifier =
    production.expo.ios.bundleIdentifier;
  normalizedDevelopment.expo.ios.googleServicesFile =
    production.expo.ios.googleServicesFile;

  assert.deepEqual(normalizedDevelopment, production);
  assert.equal(development.expo.name, "Mineral Dev");
  assert.equal(development.expo.scheme, "mineral-dev");
  assert.equal(
    development.expo.ios.bundleIdentifier,
    "com.madebymineral.quartz.dev",
  );
  assert.equal(
    development.expo.ios.googleServicesFile,
    "./GoogleService-Info.dev.plist",
  );
});

test("selector copies development and production variants in a temp fixture", () => {
  const directory = makeTempDirectory();
  try {
    const production = '{"expo":{"name":"Mineral"}}\n';
    const development = '{"expo":{"name":"Mineral Dev"}}\n';
    fs.writeFileSync(path.join(directory, "app.production.json"), production);
    fs.writeFileSync(path.join(directory, "app.development.json"), development);
    fs.writeFileSync(path.join(directory, "app.json"), '{"expo":{}}\n');

    selectAppConfig("development", { appDirectory: directory });
    assert.equal(fs.readFileSync(path.join(directory, "app.json"), "utf8"), development);

    selectAppConfig("production", { appDirectory: directory });
    assert.equal(fs.readFileSync(path.join(directory, "app.json"), "utf8"), production);
  } finally {
    removeTempDirectory(directory);
  }
});

test("selector rejects an unknown variant without changing app.json", () => {
  const directory = makeTempDirectory();
  try {
    const active = '{"expo":{"name":"Mineral"}}\n';
    fs.writeFileSync(path.join(directory, "app.json"), active);

    assert.throws(
      () => selectAppConfig("preview", { appDirectory: directory }),
      /Choose exactly "development" or "production"/,
    );
    assert.equal(fs.readFileSync(path.join(directory, "app.json"), "utf8"), active);
  } finally {
    removeTempDirectory(directory);
  }
});

test("build profile guard accepts matching identities and rejects mismatches", () => {
  const directory = makeTempDirectory();
  try {
    writeIdentityConfig(directory, {
      displayName: "Mineral Dev",
      scheme: "mineral-dev",
      bundleIdentifier: "com.madebymineral.quartz.dev",
      googleServicesFile: "./GoogleService-Info.dev.plist",
    });
    assert.equal(
      assertBuildProfile({ profile: "development", appDirectory: directory }).profile,
      "development",
    );
    assert.throws(
      () => assertBuildProfile({ profile: "production", appDirectory: directory }),
      /does not match the active static app identity/,
    );

    writeIdentityConfig(directory, {
      displayName: "Mineral",
      scheme: "mineral",
      bundleIdentifier: "com.madebymineral.quartz",
      googleServicesFile: "./GoogleService-Info.plist",
    });
    assert.equal(
      assertBuildProfile({ profile: "preview", appDirectory: directory }).profile,
      "preview",
    );
    assert.equal(
      assertBuildProfile({ profile: "production", appDirectory: directory }).profile,
      "production",
    );
    assert.throws(
      () => assertBuildProfile({ profile: "development", appDirectory: directory }),
      /does not match the active static app identity/,
    );
  } finally {
    removeTempDirectory(directory);
  }
});

test("build profile guard rejects unsupported profiles", () => {
  const directory = makeTempDirectory();
  try {
    writeIdentityConfig(directory, {
      displayName: "Mineral",
      scheme: "mineral",
      bundleIdentifier: "com.madebymineral.quartz",
      googleServicesFile: "./GoogleService-Info.plist",
    });
    assert.throws(
      () => assertBuildProfile({ profile: "unknown", appDirectory: directory }),
      /Unsupported EAS_BUILD_PROFILE/,
    );
  } finally {
    removeTempDirectory(directory);
  }
});