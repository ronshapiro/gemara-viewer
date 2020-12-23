/* eslint-disable quote-props */
import * as fs from "fs";
import {DriveClient} from "../client";
import {GoogleApiClient} from "../gapi";
import {UnsavedComment, UnsavedCommentStore} from "../types";

class RecordedApiClient extends GoogleApiClient {
  getDatabaseDocument(documentId: string): Promise<gapi.client.docs.Document> {
    return fs.promises.open(`js/google_drive/__tests__/${documentId}`, "r")
      .then(x => x.readFile({encoding: "utf-8"}))
      .then(x => JSON.parse(x));
  }

  init(): Promise<any> {
    throw new Error("Unimplemented");
  }

  isSignedIn(): boolean {
    throw new Error("Unimplemented");
  }

  signIn(): void {
    throw new Error("Unimplemented");
  }

  signOut(): void {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  registerSignInListener(listener: (isSignedIn: boolean) => void): void {
    throw new Error("Unimplemented");
  }

  getSignedInUserEmail(): string {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDocument(title: string): gapi.client.Request<gapi.client.docs.Document> {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchFiles(databaseProperty: string): gapi.client.Request<gapi.client.drive.FileList> {
    throw new Error("Unimplemented");
  }

  setDatabaseFileProperties(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fileId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    databaseProperty: string,
  ): gapi.client.Request<gapi.client.drive.File> {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  batchUpdate(params: any): Promise<any> {
    throw new Error("Unimplemented");
  }
}

class FakeUnsavedCommentStore implements UnsavedCommentStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  init(client: any): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addUnsavedComment(comment: UnsavedComment): undefined {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  markCommentSaved(id: string): any {
    throw new Error("Unimplemented");
  }
}

const client = new DriveClient(
  new RecordedApiClient(),
  new FakeUnsavedCommentStore(),
  "masechet",
  true);

function expectEqualKeys(first: any, second: any) {
  expect(new Set(Object.keys(first))).toEqual(new Set(Object.keys(second)));
}

function expectCommentsToEqual(expectedComments: any) {
  expectEqualKeys(client.rangesByRef, expectedComments);
  for (const [ref, comments] of Object.entries(expectedComments)) {
    expect(comments).toEqual(client.commentsForRef(ref)!.comments);
  }
}

function expectHighlightsToEqual(expectedHighlights: any) {
  expectEqualKeys(client.highlightsByRef, expectedHighlights);
  for (const [ref, highlights] of Object.entries(expectedHighlights)) {
    expect(highlights).toEqual(client.highlightsForRef(ref));
  }
}

test("blank document", () => {
  return client.getDatabaseDocument("blank_document.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({});
      expect(client.databaseDocument.namedRanges).toEqual({});
    });
});

test("no comments", () => {
  return client.getDatabaseDocument("no_comments.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({});
      expect(client.databaseDocument.namedRanges).toHaveProperty("Instructions Table");
    });
});

test("just amud header", () => {
  return client.getDatabaseDocument("just_amud_header.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({});
      expect(client.databaseDocument.namedRanges).toHaveProperty("header:2a");
    });
});

test("Simple v2 comments", () => {
  return client.getDatabaseDocument("simple_v2_comments.json")
    .then(() => {
      expectHighlightsToEqual({});
      expectCommentsToEqual({
        "Exodus 11:7": [{
          "en": [
            '<span class="personal-comment-bold">that you may</span> - Comment on Pasuk on Rashi',
          ],
          "he": "",
          "ref": "Exodus 11:7-personal0",
        }],
        "Pesachim 23a.7": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">עוווווד עמוד</span> - Another amud'],
          "ref": "Pesachim 23a.7-personal0",
        }],
        "Pesachim 22a.1": [
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדריטת</span> - Standard comment',
            ],
            "ref": "Pesachim 22a.1-personal0",
          },
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדרתית 2</span> - Standard comment 2',
            ],
            "ref": "Pesachim 22a.1-personal1",
          },
          {
            "en": ['<span class="personal-comment-bold">יר? אוֹתוֹ</span> - Return to earlier ref'],
            "he": "",
            "ref": "Pesachim 22a.1-personal2",
          },
        ],
        "Pesachim 22a.3": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">גִּיד הַנָּשֶׁ</span> - הערה בערבית'],
          "ref": "Pesachim 22a.3-personal0",
        }],
        "Rashi on Pesachim 22a:1:1": [{
          "en": "",
          "he": [
            '<span class="personal-comment-bold">תגובה ברש״ייייייי</span> - Comment on Rashi',
          ],
          "ref": "Rashi on Pesachim 22a:1:1-personal0",
        }],
      });
    });
});

test("v1 and v2 comments", () => {
  return client.getDatabaseDocument("v1_and_v2_comments.json")
    .then(() => {
      expectHighlightsToEqual({});
      expectCommentsToEqual({
        "Exodus 11:7": [
          {
            "en": [
              '<span class="personal-comment-bold">that you may</span> - Comment on Pasuk on Rashi',
            ],
            "he": "",
            "ref": "Exodus 11:7-personal0",
          },
          {
            "en": ["v1 - nested rashi"],
            "he": "",
            "ref": "Exodus 11:7-personal1",
          },
        ],
        "Pesachim 23a.7": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">עוווווד עמוד</span> - Another amud'],
          "ref": "Pesachim 23a.7-personal0",
        }],
        "Pesachim 22a.1": [
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדריטת</span> - Standard comment',
            ],
            "ref": "Pesachim 22a.1-personal0",
          },
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדרתית 2</span> - Standard comment 2',
            ],
            "ref": "Pesachim 22a.1-personal1",
          },
          {
            "en": ['<span class="personal-comment-bold">יר? אוֹתוֹ</span> - Return to earlier ref'],
            "he": "",
            "ref": "Pesachim 22a.1-personal2",
          },
        ],
        "Pesachim 22a.3": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">גִּיד הַנָּשֶׁ</span> - הערה בערבית'],
          "ref": "Pesachim 22a.3-personal0",
        }],
        "Rashi on Pesachim 22a:1:1": [
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובה ברש״ייייייי</span> - Comment on Rashi',
            ],
            "ref": "Rashi on Pesachim 22a:1:1-personal0",
          },
          {
            "en": ["v1 - rashi"],
            "he": "",
            "ref": "Rashi on Pesachim 22a:1:1-personal1",
          },
        ],
        "Pesachim 22a.4": [
          {
            "en": ["V1 comment"],
            "he": "",
            "ref": "Pesachim 22a.4-personal0",
          },
          {
            "en": "",
            "he": ["לללללללללללללללללללללל - v1, second comment"],
            "ref": "Pesachim 22a.4-personal1",
          },
        ],
        "Pesachim 22a.5": [{
          "en": ["v1 - a new ref"],
          "he": "",
          "ref": "Pesachim 22a.5-personal0",
        }],
        "Rashi on Pesachim 22a:1:2": [{
          "en": ["v1 - a second rashi"],
          "he": "",
          "ref": "Rashi on Pesachim 22a:1:2-personal0",
        }],
      });
    });
});

test("highlights", () => {
  return client.getDatabaseDocument("highlights.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({
        "Otzar Laazei Rashi, Talmud, Pesachim 1": [{
          "startPercentage": 0,
          "endPercentage": 0.04678362573099415,
          "highlight": true,
          "isEnglish": false,
          "range": {
            "startIndex": 265,
            "endIndex": 273,
          },
          "text": "ד\"ה יציע",
          "wordCountStart": 0,
          "wordCountEnd": 26,
        }],
        "Pesachim 8a.1": [
          {
            "startPercentage": 0.2215568862275449,
            "endPercentage": 0.24550898203592814,
            "highlight": true,
            "isEnglish": false,
            "range": {
              "startIndex": 193,
              "endIndex": 201,
            },
            "text": "לַדָּבָר",
            "wordCountStart": 10,
            "wordCountEnd": 30,
          },
          {
            "startPercentage": 0.27245508982035926,
            "endPercentage": 0.2964071856287425,
            "highlight": true,
            "isEnglish": false,
            "range": {
              "startIndex": 207,
              "endIndex": 215,
            },
            "text": "לַדָּבָר",
            "wordCountStart": 13,
            "wordCountEnd": 27,
          },
        ],
        "Rashi on Pesachim 8a:6:6": [{
          "startPercentage": 0,
          "endPercentage": 0.23684210526315788,
          "highlight": true,
          "isEnglish": false,
          "range": {
            "startIndex": 306,
            "endIndex": 324,
          },
          "text": "גג המגדל - משטיי\"ר",
          "wordCountStart": 0,
          "wordCountEnd": 11,
        }],
      });
    });
});
