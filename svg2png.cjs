const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const svgContent = fs.readFileSync("public/logo.svg", "utf8");
const outPath = path.resolve("app-icon.png");
const size = 1024;

const resvg = new Resvg(svgContent, {
  fitTo: { mode: "width", value: size },
  background: "rgba(0, 0, 0, 0)",
});

const pngBuffer = resvg.render().asPng();
fs.writeFileSync(outPath, pngBuffer);

if (pngBuffer.length > 5000 && pngBuffer[25] === 6) {
  console.log(`OK: ${outPath} (${pngBuffer.length} bytes, RGBA)`);
} else if (pngBuffer.length > 5000) {
  console.log(`OK: ${outPath} (${pngBuffer.length} bytes)`);
} else {
  console.error("PNG generation failed or output too small");
  process.exit(1);
}
