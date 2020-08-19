/* global $, gtag,  */

import {driveClient} from "./google_drive.js";
import {snackbars} from "./snackbar.js";

let selectionSnackbarRef;
const hideSelectionChangeSnackbar = (ref) => {
  if (selectionSnackbarRef) {
    gtag("event", "selection_change_snackbar.hidden", {ref});
    selectionSnackbarRef = undefined;
    snackbars.textSelection.hide();
  }
};

const findSefariaRef = (node) => {
  let isEnglish = false;
  while (node.parentElement) {
    const $parentElement = $(node.parentElement);
    isEnglish = isEnglish || $parentElement.hasClass("english");
    const isTranslationOfSourceText = $parentElement.attr("commentary-kind") === "Translation";
    const ref = $parentElement.attr("sefaria-ref");
    if (ref === "ignore") {
      break;
    }
    if (ref && ref !== "synthetic") {
      if (isEnglish && isTranslationOfSourceText) {
        // Go up one layer to the main text
        isEnglish = false;
      } else {
        return {
          ref,
          parentRef: $parentElement.parent().closest("[sefaria-ref]").attr("sefaria-ref"),
          text: $($parentElement.find(".hebrew")[0]).text(),
          translation: isTranslationOfSourceText
            ? undefined
            : $($parentElement.find(".english")[0]).text(),
          amud: $parentElement.closest(".amudContainer").attr("amud"),
        };
      }
    }
    node = node.parentNode;
  }
  return {};
};

const onSelectionChange = () => {
  let selection = document.getSelection();
  if (selection.type !== "Range") {
    hideSelectionChangeSnackbar();
    return;
  }
  const sefariaRef = findSefariaRef(selection.anchorNode);
  if (!sefariaRef.ref
      // TODO: perhaps support multiple refs, and just grab everything in between?
      // If the selection spans multiple refs, ignore them all
      || sefariaRef.ref !== findSefariaRef(selection.focusNode).ref) {
    hideSelectionChangeSnackbar(sefariaRef.ref);
    return;
  }
  if (sefariaRef.ref === selectionSnackbarRef) {
    // do nothing, since the snackbar is already showing the right information
    return;
  }

  const {ref} = sefariaRef;
  const sefariaUrl = `https://www.sefaria.org/${ref.replace(/ /g, "_")}`;
  gtag("event", "selection_change_snackbar.shown", {ref});
  selectionSnackbarRef = ref;
  // don't allow buttons to refer to the selection that triggered the snackbar, since the selection
  // may have changed
  selection = undefined;
  const buttons = [
    {
      text: "View on Sefaria",
      onClick: () => {
        window.location = sefariaUrl;
        gtag("event", "view_on_sefaria", {ref});
      },
    },
    {
      text: "Report correction",
      onClick: () => {
        gtag("event", "report_correction", {ref});
        const subject = "Sefaria Text Correction from talmud.page";
        let body = [
          `${ref} (${sefariaUrl})`,
          sefariaRef.text,
        ];
        if (sefariaRef.translation && sefariaRef.translation !== "") {
          body.push(sefariaRef.translation);
        }
        // trailing newline so that the description starts on its own line
        body.push("Describe the error:");

        body = body.join("\n\n");
        body = encodeURIComponent(body);
        window.open(`mailto:corrections@sefaria.org?subject=${subject}&body=${body}`);
      },
    },
  ];
  if (driveClient.isSignedIn && !driveClient.errors.length) {
    buttons.push({
      text: "Add Note",
      onClick: () => {
        const modalContainer = $("#modal-container");
        const noteTextArea = $("#personal-note-entry");
        modalContainer.show();
        $("#modal-label").text(`Add a note on ${sefariaRef.ref}`);
        // Get the possibly-updated selection
        noteTextArea.val(document.getSelection().toString());
        $("#modal-cancel").off("click").on("click", () => modalContainer.hide());
        $("#modal-save").off("click").on("click", () => {
          driveClient.appendNamedRange(
            noteTextArea.val(),
            sefariaRef.amud,
            sefariaRef.ref,
            sefariaRef.parentRef || sefariaRef.ref);
          modalContainer.hide();
        });
      },
    });
  }

  snackbars.textSelection.show(ref, buttons);
};

module.exports = {
  registerRefSelectionSnackbarListener: () => {
    document.addEventListener("selectionchange", onSelectionChange);
  },
};
