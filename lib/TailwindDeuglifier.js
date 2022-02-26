const fs = require("fs/promises");
const path = require("path");
const CleanCSS = require("clean-css");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const mediaMap = require("./mediaMap");

class TailwindDeuglifier {
  /**
   * Create Deuglifier instance.
   *
   * You must specify either the cssPath or the htmlPath
   * @param {{
   * tailwindCSSPath: string,
   * htmlPath: string,
   * cssPath?: string,
   * }} options
   */
  constructor(options) {
    this.minifier = new CleanCSS({ level: 2 });
    this.options = options;
    this.cssMap = {};
  }

  async init() {
    await this.initTailwindCSS();

    if (this.options.cssPath) {
      await this.initCss();
    } else {
      await this.initHtmlCss();
    }
  }

  async initTailwindCSS() {
    const file = await fs.readFile(this.options.tailwindCSSPath, "utf8");
    this.tailwindCSS = this.minifier.minify(file).styles;
  }

  async initCss() {
    const file = await fs.readFile(this.options.cssPath, "utf8");
    this.css = this.minifier.minify(file).styles;
  }

  async initHtmlCss() {
    const file = await fs.readFile(this.options.htmlPath, "utf8");
    const dom = new JSDOM(file);
    const styles = [...dom.window.document.querySelectorAll("style")]
      .map((s) => s.textContent)
      .join("\n");

    this.css = this.minifier.minify(styles).styles;
  }

  async generateMap() {
    this.generateTailwindCSSMap();
    this.generateResponsiveCSSMap();
    this.generateCSSMap();

    const map = {};

    for (const [selector, rules] of Object.entries(this.tailwindCSSMap)) {
      const responsiveGroup = selector.split(":")[0];
      if (responsiveGroup in mediaMap.classToBreakpoint) {
        const match = Object.entries(this.responsiveCssMap).find(
          ([k, v]) => k.includes(responsiveGroup) && v === rules
        );
        if (match) {
          const [group, className] = match[0].split(":");
          map[className] = {
            group,
            selector,
            rules,
          };
        }
      } else {
        const match = Object.entries(this.cssMap).find(([k, v]) => v === rules);
        if (match && !(match[0] in map)) {
          map[match[0]] = {
            selector,
            rules,
          };
        }
      }
    }

    this.map = map;
  }

  generateTailwindCSSMap() {
    const tailwindCSSMap = {};
    const regex = /\.([\w-\\.:]+){([^}]+)}/g;

    for (const [, selector, rules] of this.tailwindCSS.matchAll(regex)) {
      tailwindCSSMap[selector] = rules;
    }

    this.tailwindCSSMap = tailwindCSSMap;
  }

  generateCSSMap() {
    const cssMap = {};
    const regex = /\.([\w-\\.:]+){([^}]+)}/g;

    for (const [, selector, rules] of this.css.matchAll(regex)) {
      cssMap[selector] = rules;
    }

    this.cssMap = { ...this.cssMap, ...cssMap };
  }

  generateResponsiveCSSMap() {
    const cssMap = {};
    const regex = /@media \(([^)]+)\){/g;

    for (const match of this.css.matchAll(regex)) {
      let [media, breakpoint] = match;
      breakpoint = breakpoint.split(":")[1];
      let remainingBrackets = 1;
      let i = match.index + media.length;
      let innerRules = "";
      while (remainingBrackets > 0) {
        const char = this.css[i];
        if (char === "{") {
          remainingBrackets++;
        } else if (char === "}") {
          remainingBrackets--;
        }
        innerRules += char;
        i++;
      }

      const regex = /\.([\w-\\.:]+){([^}]+)}/g;

      for (const [, selector, rules] of innerRules.matchAll(regex)) {
        cssMap[`${mediaMap.breakpointToClass[breakpoint]}:${selector}`] = rules;
      }
    }

    this.responsiveCssMap = cssMap;
  }

  async createStylesheet() {
    let stylesheet = "";
    for (const { group, selector, rules } of Object.values(this.map)) {
      if (group) {
        stylesheet += `@media (min-width: ${mediaMap.classToBreakpoint[group]}) {.${selector} { ${rules}; }}\n`;
      } else {
        stylesheet += `.${selector} { ${rules}; }\n`;
      }
    }

    this.stylesheet = this.minifier.minify(stylesheet).styles;
  }

  async createHtml() {
    const html = await fs.readFile(this.options.htmlPath, "utf8");
    const dom = new JSDOM(html);
    const document = dom.window.document;
    // document.querySelectorAll("style").forEach((s) => {
    //   s.remove();
    // });
    const newStyles = document
      .querySelector("head")
      .appendChild(document.createElement("style"));

    newStyles.innerHTML = this.stylesheet;

    document.querySelectorAll("*").forEach((e) => {
      e.classList = [...e.classList]
        .map((c) => {
          if (c in this.map) {
            return this.map[c].selector.replace(/\\/g, "");
          } else {
            return c;
          }
        })
        .join(" ");
    });

    return dom.serialize();
  }
}

module.exports = TailwindDeuglifier;
