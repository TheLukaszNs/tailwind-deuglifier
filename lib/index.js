const fs = require("fs/promises");
const path = require("path");
const CleanCSS = require("clean-css");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const generateMap = async (tailwindPath, inFile) => {
  const tailwind = await await fs.readFile(tailwindPath, "utf8");
  const tailwindClasses = {};
  const inClasses = {};
  const outMap = {};

  const tailwindMinified = new CleanCSS({}).minify(tailwind).styles;

  const regex = /\.([\w-:\\.\[\]]+){([^}]+)}/g;
  for (const match of tailwindMinified.matchAll(regex)) {
    tailwindClasses[match[1]] = match[2];
  }

  const ext = path.extname(inFile);
  const inContent = await fs.readFile(inFile, "utf8");
  let inMinified;

  if (ext == ".html") {
    inMinified = await preprocessHtml(inContent);
  } else {
    inMinified = new CleanCSS({}).minify(inContent).styles;
  }

  for (const match of inMinified.matchAll(regex)) {
    inClasses[match[1]] = match[2];
  }

  for (const [tClass, tValue] of Object.entries(tailwindClasses)) {
    const mapValue = Object.entries(inClasses).find(([k, v]) => v == tValue);
    if (mapValue && !(mapValue[0] in outMap)) {
      outMap[mapValue[0]] = tClass;
    }
  }

  return outMap;
};

const preprocessHtml = async (html) => {
  const dom = new JSDOM(html);
  const styles = [...dom.window.document.querySelectorAll("style")]
    .map((s) => s.textContent)
    .join("\n");

  return new CleanCSS({}).minify(styles).styles;
};

const saveProcessed = async (htmlFile, map) => {
  const html = await fs.readFile(htmlFile, "utf8");
  const dom = new JSDOM(html);

  const elements = dom.window.document.querySelectorAll("*");
  for (const element of elements) {
    if (element.classList.length > 0) {
      const mappedClasses = [...element.classList]
        .map((c) => (c in map ? map[c] : c))
        .join(" ");
      element.classList = mappedClasses;
    }
  }

  const styleElements = dom.window.document.querySelectorAll("style");
  let styles = [...styleElements].map((s) => s.textContent).join("\n");

  Object.keys(map).forEach((k) => {
    styles = styles.replace(
      new RegExp(`\\.${k}(?=[\\s:{])`, "g"),
      `.${map[k]}`
    );
  });

  styleElements.forEach((s) => s.remove());
  const newStyle = dom.window.document
    .querySelector("head")
    .appendChild(dom.window.document.createElement("style"));
  newStyle.textContent = styles;

  const htmlOut = await fs.open("out.html", "w");

  await htmlOut.write(dom.serialize());
};

module.exports = { generateMap, preprocessHtml, saveProcessed };
