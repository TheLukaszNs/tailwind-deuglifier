const path = require("path");
const { generateMap, saveProcessed } = require("./lib");

let htmlFile, cssFile, tailwindPath;

if (process.argv.length == 4) {
  tailwindPath = process.argv[2];
  htmlFile = cssFile = process.argv[3];
} else if (process.argv.length == 5) {
  tailwindPath = process.argv[2];
  htmlFile = process.argv[3];
  cssFile = process.argv[4];
} else {
  console.log("Usage: node index.js <tailwind.css> <in.html> [<in.css>]");
  process.exit(1);
}

console.log("Generating out.html...");

generateMap(path.join(__dirname, tailwindPath), path.join(__dirname, cssFile))
  .then(async (map) => saveProcessed(path.join(__dirname, htmlFile), map))
  .then(() => {
    console.log("Generated out.html...");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
