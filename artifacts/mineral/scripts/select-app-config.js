"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CONFIG_VARIANTS = new Set(["development", "production"]);

function getAppDirectory(options = {}) {
  return path.resolve(options.appDirectory ?? path.resolve(__dirname, ".."));
}

function assertVariant(variant) {
  if (!CONFIG_VARIANTS.has(variant)) {
    throw new Error(
      `Unknown app config "${variant}". Choose exactly "development" or "production".`,
    );
  }
}

function validateStaticJson(filePath, contents) {
  try {
    JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`Cannot select invalid static config ${filePath}: ${message}`);
  }
}

/**
 * Copy one of the checked-in static app variants to the active app.json.
 *
 * @param {"development"|"production"} variant
 * @param {{appDirectory?: string}} [options]
 */
function selectAppConfig(variant, options = {}) {
  assertVariant(variant);

  const appDirectory = getAppDirectory(options);
  const sourcePath = path.join(appDirectory, `app.${variant}.json`);
  const targetPath = path.join(appDirectory, "app.json");
  const sourceContents = fs.readFileSync(sourcePath, "utf8");

  // Validate before replacing app.json so a malformed checked-in variant
  // cannot leave the project with a partially selected configuration.
  validateStaticJson(sourcePath, sourceContents);
  fs.copyFileSync(sourcePath, targetPath);

  return { sourcePath, targetPath, variant };
}

function parseCliArguments(argumentsList) {
  const [variant, ...rest] = argumentsList;
  if (!variant || (rest.length > 0 && (rest.length !== 2 || rest[0] !== "--app-dir"))) {
    throw new Error(
      "Usage: node scripts/select-app-config.js <development|production> [--app-dir <directory>]",
    );
  }

  return {
    variant,
    appDirectory: rest.length === 2 ? rest[1] : undefined,
  };
}

if (require.main === module) {
  try {
    const { variant, appDirectory } = parseCliArguments(process.argv.slice(2));
    const result = selectAppConfig(variant, { appDirectory });
    console.log(`Selected ${result.variant} static app config.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  CONFIG_VARIANTS,
  parseCliArguments,
  selectAppConfig,
};