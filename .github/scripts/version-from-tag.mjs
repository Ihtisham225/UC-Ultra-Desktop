/**
 * Stamps package.json with the version from the tag being built.
 *
 * The tag is the source of truth for a release, not package.json. Git refuses
 * to push a tag that already exists, so tags are unique by construction —
 * whereas two branches open at once will happily bump package.json to the same
 * number, and whichever published last would win the auto-update. That
 * happened twice in one week (v1.0.65 and v1.0.67), so the number in
 * package.json is now only a placeholder for local development.
 *
 * Runs before the build, because electron-builder reads the version out of
 * package.json when it packages and writes the update manifests.
 */
import { readFileSync, writeFileSync } from "node:fs";

const tag = process.env.GITHUB_REF_NAME ?? "";
const version = tag.replace(/^v/, "");

// Only ever accept a plain release version. A malformed tag silently producing
// a nonsense build is worse than stopping here.
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Refusing to build: "${tag}" is not a version tag (expected v1.2.3).`);
  process.exit(1);
}

const path = new URL("../../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(path, "utf8"));
const was = pkg.version;
pkg.version = version;
writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Building ${version} (package.json said ${was}; the tag wins).`);
