import {Attributes, HtmlVisitor} from "./html_visitor";

// This is intentional - we want a value that is not identical to any other value
// eslint-disable-next-line no-new-wrappers,unicorn/new-for-builtins
const placeholder = new String() as string;

export class ImageNumberingFormatter extends HtmlVisitor {
  imageTags: string[] = [];
  hasProcessedText = false;
  isInImage = false;

  shouldRun(input: string): boolean {
    return input.includes("<img");
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    if (tag === "img") {
      const newTag: string[] = [];
      this.appendStartTag(tag, attributes, newTag);
      this.imageTags.push(newTag.join(""));
      this._out.push(placeholder);
    } else {
      this.appendStartTag(tag, attributes);
    }
  }

  visitEndTag(tag: string): void {
    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    this.appendText(text);
  }

  formatImageReference(counter: number): string {
    return (counter === 1 && this.imageTags.length === 1)
      ? "(*)"
      : `(${counter})`;
  }

  beforeJoin(): void {
    if (this.imageTags.length === 0) {
      return;
    }

    const newOut: string[] = [];
    let imageCounter = 0;

    for (const piece of this._out) {
      if (piece !== placeholder) {
        newOut.push(piece);
      } else {
        const imageReference = this.formatImageReference(imageCounter + 1);
        newOut.push(
          '<span class="image-ref-container">',
          `<span class="image-ref-text">${imageReference}:</span>`,
          '<span class="image-ref">',
          this.imageTags[imageCounter],
          "</span>",
          "</span>",
          `<span class="image-pointer">${imageReference}</span>`,
        );
        imageCounter += 1;
      }
    }

    this._out = newOut;
  }
}
