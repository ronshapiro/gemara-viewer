// @ts-ignore
import {LanguageStats, ParagraphElement, Range} from "./types.ts";

interface Predicate<T> {
  (t: T): boolean;
}

type Indexable = Pick<ParagraphElement, "startIndex" | "endIndex">;

export const inRange = (range: Range): Predicate<Indexable> => (x) => {
  if (x.startIndex === range.startIndex) {
    return true;
  } else if (x.startIndex < range.startIndex) {
    return x.endIndex > range.startIndex;
  }
  return x.startIndex < range.endIndex;
};

const updateText = (element: ParagraphElement, updated: string): ParagraphElement => {
  const original = element.textRun.content;
  if (updated === original) {
    return element;
  }
  return {
    ...element,
    textRun: {
      ...element.textRun,
      content: updated,
    },
  };
};

interface ElementsProcessor {
  (elements: ParagraphElement[]): ParagraphElement[];
}

const trimContents: ElementsProcessor = (elements) => (
  elements.map(element => updateText(element, element.textRun.content.trim()))
);

// TODO: add simple styles. But doing so would mangle indices, so perhaps collect styles and apply
// them at the end?
export const joinAdjacentElements: ElementsProcessor = (elements) => {
  if (elements.length <= 1) {
    return elements;
  }
  const joinedElements = elements.slice(0, 1);
  for (const current of elements.slice(1)) {
    const previous = joinedElements.slice(-1)[0];
    if (previous.endIndex === current.startIndex) {
      const joined = {
        startIndex: previous.startIndex,
        endIndex: current.endIndex,
        textRun: {
          content: previous.textRun.content + current.textRun.content,
        },
        languageStats: {
          hebrew: previous.languageStats!.hebrew + current.languageStats!.hebrew,
          english: previous.languageStats!.english + current.languageStats!.english,
        },
      };
      joinedElements.pop();
      joinedElements.push(joined);
    } else {
      joinedElements.push(current);
    }
  }

  return joinedElements;
};

const htmlEscape: ElementsProcessor = elements => (
  elements.map(x => updateText(x, x.textRun.content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#039;")
    .replace(/"/g, "&quot;")))
);

const newlineToBr: ElementsProcessor = elements => (
  elements.map(x => updateText(x, x.textRun.content.replace(/\n/g, "<br>")))
);

const trimTextsByFilterRange = (range: Range): ElementsProcessor => {
  return elements => (
    elements.map(x => {
      const text = x.textRun.content;
      return updateText(
        x,
        text.substring(
          range.startIndex - x.startIndex,
          range.endIndex > x.endIndex ? text.length : text.length - (x.endIndex - range.endIndex)));
    })
  );
};

const HEBREW_LETTERS = /[א-ת]/g;
const LATIN_LETTERS = /[a-zA-Z]/g;

const numMatches = (regex: RegExp, input: string): number => {
  return (input.match(regex) || []).length;
};

const computeLanguageStats: ElementsProcessor = elements => (
  elements.map(x => {
    return {
      ...x,
      languageStats: {
        hebrew: numMatches(HEBREW_LETTERS, x.textRun.content),
        english: numMatches(LATIN_LETTERS, x.textRun.content),
      },
    };
  })
);

const applyTextStyle: ElementsProcessor = elements => (
  elements.map(element => {
    let text = element.textRun.content;
    const style = element.textRun.textStyle || {};
    const classes = (
      ["bold", "italic", "underline", "strikethrough"]
        .filter(x => style[x])
        .map(x => `personal-comment-${x}`)
        .join(" ")
    );
    if (classes.length > 0) {
      text = `<span class="${classes}">${text}</span>`;
    }
    if (style.link && style.link.url) {
      text = `<a href="${style.link.url}">${text}</a>`;
    }
    return updateText(element, text);
  })
);

export interface DocumentText {
  text: string;
  languageStats: LanguageStats;
}

export const extractDocumentText = (
  range: Range, inputs: ParagraphElement[],
): DocumentText[] => {
  const transformations: ElementsProcessor[] = [
    elements => elements.filter(inRange(range)),
    trimTextsByFilterRange(range),
    computeLanguageStats,
    htmlEscape,
    applyTextStyle,
    joinAdjacentElements,
    trimContents,
    // don't run as part of htmlEscape, because then trimContents() won't detect the <br> tgas
    newlineToBr,
  ];

  let transformed = inputs;
  for (const transformation of transformations) {
    transformed = transformation(transformed);
  }
  return transformed.map(x => {
    return {
      text: x.textRun.content,
      languageStats: x.languageStats!,
    };
  });
};
