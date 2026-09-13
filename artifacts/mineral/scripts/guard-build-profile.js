"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PRODUCTION_IDENTITY = Object.freeze({
  displayName: "Mineral",
  bundleIdentifier: "com.madebymineral.quartz",
  scheme: "mineral",
  googleServicesFile: "./GoogleService-Info.plist",
});

const DEVELOPMENT_IDENTITY = Object.freeze({
  displayName: "Mineral Dev",
  bundleIdentifier: "com.madebymineral.quartz.dev",
  scheme: "mineral-dev",
  googleServicesFile: "./GoogleService-Info.dev.plist",
});

const PROFILE_IDENTITIES = Object.freeze({
  development: DEVELOPMENT_IDENTITY,
  preview: PRODUCTION_IDENTITY,
  production: PRODUCTION_IDENTITY,
});

function getAppDirectory(options = {}) {
  return path.resolve(options.appDirectory ?? path.resolve(__dirname, ".."));
}

function readActiveConfig(appDirectory) {
  const appPath = path.join(appDirectory, "app.json");
  let contents;

  try {
    contents = fs.readFileSync(appPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to read app.json";
    throw new Error(`Cannot inspect active app config at ${appPath}: ${message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`Cannot inspect active app config at ${appPath}: ${message}`);
  }
}

function getActiveIdentity(config) {
  const expo = config && typeof config === "object" ? config.expo : undefined;
  const ios = expo && typeof expo === "object" ? expo.ios : undefined;

  return {
    displayName: expo && typeof expo === "object" ? expo.name : undefined,
    bundleIdentifier: ios && typeof ios === "object" ? ios.bundleIdentifier : undefined,
    scheme: expo && typeof expo === "object" ? expo.scheme : undefined,
    googleServicesFile:
      ios && typeof ios === "object" ? ios.googleServicesFile : undefined,
  };
}

/**
 * Verify that the checked-in active app.json belongs to the EAS profile.
 *
 * With no EAS_BUILD_PROFILE (for example, a local dependency install), this
 * is intentionally a no-op. EAS supplies the profile during a build.
 *
 * @param {{profile?: string, appDirectory?: string}} [options]
 */
function assertBuildProfile(options = {}) {
  const profile = options.profile ?? process.env.EAS_BUILD_PROFILE;
  if (!profile) {
    return { skipped: true };
  }

  const expectedIdentity = PROFILE_IDENTITIES[profile];
  if (!expectedIdentity) {
    throw new Error(
      `Unsupported EAS_BUILD_PROFILE "${profile}". Expected development, preview, or production.`,
    );
  }

  const appDirectory = getAppDirectory(options);
  const activeIdentity = getActiveIdentity(readActiveConfig(appDirectory));
  const mismatches = Object.keys(expectedIdentity).filter(
    (key) => activeIdentity[key] !== expectedIdentity[key],
  );

  if (mismatches.length > 0) {
    throw new Error(
      `EAS_BUILD_PROFILE "${profile}" does not match the active static app identity. ` +
        `Mismatched fields: ${mismatches.join(", ")}. ` +
        `Select the matching checked-in app.${profile === "development" ? "development" : "production"}.json before building.`,
    );
  }

  return {
    skipped: false,
    profile,
    identity: expectedIdentity,
  };
}

function parseCliArguments(argumentsList) {
  if (argumentsList.length === 0) {
    return {};
  }

  if (
    argumentsList.length !== 2 ||
    argumentsList[0] !== "--app-dir" ||
    !argumentsList[1]
  ) {
    throw new Error("Usage: node scripts/guard-build-profile.js [--app-dir <directory>]");
  }

  return { appDirectory: argumentsList[1] };
}

if (require.main === module) {
  try {
    assertBuildProfile(parseCliArguments(process.argv.slice(2)));
    console.log("Build profile matches the active static app identity.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  DEVELOPMENT_IDENTITY,
  PROFILE_IDENTITIES,
  PRODUCTION_IDENTITY,
  assertBuildProfile,
  getActiveIdentity,
  parseCliArguments,
};