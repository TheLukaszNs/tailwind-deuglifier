const path = require("path");
const { exit } = require("process");
const fs = require("fs/promises");
const TailwindDeuglifier = require("./lib/TailwindDeuglifier");

const main = async () => {
  const deuglifier = new TailwindDeuglifier({
    tailwindCSSPath: path.resolve(__dirname, "./tailwind.css"),
    htmlPath: path.resolve(__dirname, "./index.html"),
  });

  await deuglifier.init();
  await deuglifier.generateMap();
  await deuglifier.createStylesheet();
  const html = await deuglifier.createHtml();

  await fs.writeFile("out.html", html);
};

try {
  main();
} catch (error) {
  console.error(error);
  exit(1);
}
