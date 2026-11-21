import { execFileSync } from "node:child_process";
import { brotliDecompressSync } from "node:zlib";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const sourcePartsDir = path.join(root, "apps", "alkane", "source-parts");
const buildDir = mkdtempSync(path.join(tmpdir(), "folio-alkane-"));
const tarPath = path.join(buildDir, "alkane-source.tar");
const outputDir = path.join(root, "public", "apps", "alkane");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const runOptions = {
  cwd: buildDir,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
};

try {
  if (!existsSync(sourcePartsDir)) {
    throw new Error(`Alkane source parts are missing: ${sourcePartsDir}`);
  }

  const sourceParts = readdirSync(sourcePartsDir)
    .filter((name) => /^part-\d+\.b64$/.test(name))
    .sort();
  if (!sourceParts.length) {
    throw new Error("No Alkane source archive parts were found.");
  }

  const encodedArchive = sourceParts
    .map((name) => readFileSync(path.join(sourcePartsDir, name), "utf8").trim())
    .join("");
  const compressedArchive = Buffer.from(encodedArchive, "base64");
  if (compressedArchive.length < 1024) {
    throw new Error("The Alkane source archive is unexpectedly small.");
  }

  writeFileSync(tarPath, brotliDecompressSync(compressedArchive));
  execFileSync("tar", ["-xf", tarPath, "-C", buildDir], { stdio: "inherit" });
  execFileSync(npm, ["ci", "--include=dev", "--no-audit", "--no-fund"], runOptions);
  execFileSync(npm, ["run", "build"], runOptions);

  const distDir = path.join(buildDir, "dist");
  if (!existsSync(path.join(distDir, "index.html"))) {
    throw new Error("Alkane build completed without producing dist/index.html.");
  }

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(path.dirname(outputDir), { recursive: true });
  cpSync(distDir, outputDir, { recursive: true });
  console.log("Alkane is ready at /apps/alkane/");
} finally {
  rmSync(buildDir, { recursive: true, force: true });
}
