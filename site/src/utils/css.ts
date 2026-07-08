import { injectCss } from "@ohmycv/dynamic-css";
import { useConstant } from "~/composables/constant";
import type { ResumeStyles } from "~/composables/stores/style";

const { RENDER } = useConstant();

/**
 * Service for injecting dynamic CSS into the document.
 *
 * Note: This service will not handle margins, height and width, which should be
 * handled by the `vue-smart-pages` package.
 */
export class DynamicCssService {
  constructor() {}

  private _selector = (id?: string | number) => {
    return `#resume-${id ?? RENDER.PREVIEW_ID}`;
  };

  private _injectedCssId = (type: "toolbar" | "css-editor", id?: string | number) => {
    return `ohmycv-${type}-${id ?? RENDER.PREVIEW_ID}`;
  };

  /**
   * Static CSS that is not driven by a toolbar setting but should apply to
   * every resume at render time (existing and new), so it does not depend on
   * the per-resume CSS document:
   *  - `.resume-header-image`: the optional profile photo (frontmatter `image`)
   *    rendered as a centered circle above the name.
   *  - centered section headers (`h2`).
   *  - `.resume-company-logo`: an optional company logo (inline `<img>` placed at
   *    the start of an experience entry) floated to the left of the entry so the
   *    company/role and location/period rows sit beside it.
   */
  private staticExtras = (selector: string) => {
    return (
      `${selector} .resume-header-image { display: block; width: 7em; height: 7em; margin: 0 auto 0.6em; border-radius: 50%; object-fit: cover; }` +
      `${selector} h2 { text-align: center; }` +
      `${selector} .resume-company-logo { float: left; width: 2.9em; height: 2.9em; margin: 0.15em 0.7em 0.15em 0; object-fit: contain; }`
    );
  };

  private themeColor = (selector: string, styles: ResumeStyles) => {
    return (
      `${selector} :not(.resume-header-item) > a { color: ${styles.themeColor}; }` +
      `${selector} h1, ${selector} h2, ${selector} h3 { color: ${styles.themeColor}; }` +
      `${selector} h2 { border-bottom-color: ${styles.themeColor}; }`
    );
  };

  private lineHeight = (selector: string, styles: ResumeStyles) => {
    const height = styles.lineHeight;

    return (
      `${selector} p, ${selector} li { line-height: ${height.toFixed(2)}; }` +
      `${selector} h2, ${selector} h3 { line-height: ${(height * 1.154).toFixed(2)}; }` +
      `${selector} dl { line-height: ${(height * 1.038).toFixed(2)}; }`
    );
  };

  private paragraphSpace = (selector: string, styles: ResumeStyles) => {
    return `${selector} h2 { margin-top: ${styles.paragraphSpace}px; }`;
  };

  private fontFamily = (selector: string, styles: ResumeStyles) => {
    const fontEN = styles.fontEN.fontFamily || styles.fontEN.name;
    const fontCJK = styles.fontCJK.fontFamily || styles.fontCJK.name;
    return `${selector} { font-family: ${fontEN}, ${fontCJK}, Arial, Helvetica, sans-serif; }`;
  };

  private fontSize = (selector: string, styles: ResumeStyles) => {
    return `${selector} { font-size: ${styles.fontSize}px; }`;
  };

  private paperSize = (styles: ResumeStyles) => {
    return `@media print { @page { size: ${styles.paper}; } }`;
  };

  /**
   * Inject CSS that controlled by the toolbar into the document.
   *
   * @param styles Resume styles
   * @param id Element ID of the corresponding resume element (dashboard). If not
   * provided, it will be set to "preview", which is the preview view in the editor.
   */
  public injectToolbar(styles: ResumeStyles, id?: string | number) {
    const selector = this._selector(id);

    const css =
      this.staticExtras(selector) +
      this.fontFamily(selector, styles) +
      this.fontSize(selector, styles) +
      this.themeColor(selector, styles) +
      this.paragraphSpace(selector, styles) +
      this.lineHeight(selector, styles) +
      // We only need to set paper size for the preview view in the editor
      (id === undefined ? this.paperSize(styles) : "");

    injectCss(this._injectedCssId("toolbar", id), css);
  }

  /**
   * Inject CSS that controlled by the CSS editor into the document.
   *
   * @param css CSS string
   * @param id Element ID of the corresponding resume element (dashboard). If not
   * provided, it will be set to "preview", which is the preview view in the editor.
   */
  public injectCssEditor(css: string, id?: string | number) {
    if (id !== undefined) {
      // To control each resume element (dashboard) separately
      css = css.replaceAll(RENDER.PREVIEW_SELECTOR, this._selector(id));
    }

    injectCss(this._injectedCssId("css-editor", id), css);
  }
}

export const dynamicCssService = new DynamicCssService();
