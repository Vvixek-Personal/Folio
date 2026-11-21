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

  const bridgePath = path.join(root, "apps", "alkane", "folio-bridge.js");
  if (!existsSync(bridgePath)) throw new Error("Alkane Folio bridge is missing.");
  cpSync(bridgePath, path.join(outputDir, "folio-bridge.js"));

  // Add stable node IDs to the layer list so the bridge can reorder the
  // actual canvas nodes through Alkane's existing context-menu actions.
  let patchedLayerRows = 0;
  const layerMarker = 'className:`layer-row ${t.includes(v.id)?"selected":""} ${v.hidden?"muted":""}`,onContextMenu:';
  const visitOutput = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visitOutput(file);
      else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".html"))) {
        const original = readFileSync(file, "utf8");
        if (original.includes(layerMarker)) {
          const patched = original.replace(layerMarker, '`"data-layer-id":v.id,"data-layer-locked":v.locked,draggable:!v.locked,' + layerMarker);
          writeFileSync(file, patched);
          patchedLayerRows += 1;
        }
      }
    }
  };
  visitOutput(outputDir);
  if (!patchedLayerRows) throw new Error("Could not locate Alkane's layer list in the built output; drag-to-reorder was not installed.");

  const htmlPath = path.join(outputDir, "index.html");
  const html = readFileSync(htmlPath, "utf8");
  if (!html.includes("folio-bridge.js")) {
    if (!html.includes("</body>")) throw new Error("Alkane index.html has no closing body tag.");
    writeFileSync(htmlPath, html.replace("</body>", '  <script src="./folio-bridge.js" defer></script>\\n</body>'));
  }
  console.log(`Alkane is ready at /apps/alkane/ (layer patch applied to ${patchedLayerRows} bundle file(s)).`);
} finally {
  rmSync(buildDir, { recursive: true, force: true });
}
