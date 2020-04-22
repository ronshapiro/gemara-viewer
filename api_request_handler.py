#!/usr/bin/python
# -*- coding: utf-8 -*-

from jastrow_reformat import reformat_jastrow
from link_sanitizer import sanitize_sefaria_links
from source_formatting.hebrew_small_to_emphasis import reformat_hebrew_small_text
from source_formatting.dibur_hamatchil import bold_diburei_hamatchil
import re
import requests

HADRAN_PATTERN = re.compile("^(<br>)+<big><strong>הדרן עלך .*")
BR_PREFIX = re.compile("^(<br>)+")

class RealRequestMaker(object):
    def request_amud(self, ref):
        return requests.get(
            # https://github.com/Sefaria/Sefaria-Project/wiki/API-Documentation
            f"https://sefaria.org/api/texts/{ref}",
            params = {
                "commentary": "1",
                # Even with wrapLinks=1, Jastrow (and perhaps more) is still wrapped. Instead, an active
                # filtering is performed just in case.
                "wrapLinks": "0",
                # This shouldn't have a difference for the Gemara reqeusts, but it does expand the
                # Rashi/Tosafot requests to have the entire amud's worth of commentary
                "pad": "0",
            })

class ApiRequestHandler(object):
    def __init__(self, request_maker):
        self._request_maker = request_maker

    def amud_api_request(self, masechet, amud):
        sefaria_results = [
            self._request_maker.request_amud(f"{masechet}.{amud}"),
            self._request_maker.request_amud(f"Rashi_on_{masechet}.{amud}"),
            self._request_maker.request_amud(f"Tosafot_on_{masechet}.{amud}"),
        ]

        bad_results = list(filter(lambda x: x.status_code is not 200, sefaria_results))
        def _create_error():
            return "\n".join(map(lambda x: x.text, bad_results)), 500
        if bad_results:
            return _create_error()

        try:
            results_as_json = list(map(lambda x: x.json(), sefaria_results))
        except:
            return _create_error()

        result = {"id": amud}

        gemara_json, rashi_json, tosafot_json = results_as_json
        for i in ["title"]:
            result[i] = gemara_json[i]

        hebrew = gemara_json["he"]
        english = gemara_json["text"]

        if len(hebrew) != len(english):
            gemara_result = sefaria_results[0]
            return "Hebrew length != English length: %s" %(gemara_result.text), 500

        sections = result["sections"] = []
        for i in range(len(hebrew)):
            sections.append({
                "he": hebrew[i],
                "en": sanitize_sefaria_links(english[i]),
                "ref": "%s.%s" %(gemara_json["ref"], i + 1),
                "commentary": {},
                })

        section_prefix = "%s %s:" %(gemara_json["book"], amud)
        for comment in gemara_json["commentary"]:
            self._add_comment_to_result(comment, sections, section_prefix)
        for comment in rashi_json["commentary"]:
            self._add_second_level_comment_to_result(comment, sections, "Rashi")
        for comment in tosafot_json["commentary"]:
            self._add_second_level_comment_to_result(comment, sections, "Tosafot")

        last_section = result["sections"][len(result["sections"]) - 1]
        if HADRAN_PATTERN.findall(last_section["he"]):
            last_section["he"] = BR_PREFIX.sub("<br>", last_section["he"])
            last_section["en"] = ""
            last_section["commentary"] = {}
            last_section["hadran"] = True

        return result

    def _add_comment_to_result(self, comment, sections, section_prefix):
        if len(comment["he"]) is 0 and \
           len(comment["text"]) is 0:
            return

        # TODO: question: if this spans multiple sections, is placing it in the first always correct?
        section = int(comment["anchorRefExpanded"][0][len(section_prefix):]) - 1

        if section >= len(sections):
            print("Unplaceable comment:", comment["sourceRef"], comment["anchorRefExpanded"])
            return

        commentary_dict = sections[section]["commentary"]
        matching_commentary_kind = _matching_commentary_kind(comment)
        if not matching_commentary_kind:
            return

        english_name = matching_commentary_kind["englishName"]
        if english_name not in commentary_dict:
            commentary_dict[english_name] = {"comments": []}

        commentary_dict[english_name]["comments"].append(
            self._make_comment_json(comment, english_name))

    def _add_second_level_comment_to_result(self, comment, sections, first_level_commentary_name):
        ref_split = comment["anchorRefExpanded"][0].split(":")
        section = int(ref_split[1]) - 1

        if section >= len(sections):
            print("Unplaceable second level comment:",
                  comment["sourceRef"],
                  comment["anchorRefExpanded"])
            return

        matching_commentary_kind = _matching_commentary_kind(comment)
        if not matching_commentary_kind:
            return

        first_level_commentary = sections[section]["commentary"][first_level_commentary_name]

        if "commentary" not in first_level_commentary:
            first_level_commentary["commentary"] = {}
        second_level_commentaries = first_level_commentary["commentary"]

        english_name = matching_commentary_kind["englishName"]
        if english_name not in second_level_commentaries:
            second_level_commentaries[english_name] = {"comments": []}

        second_level_commentaries[english_name]["comments"].append(
            self._make_comment_json(comment, english_name))


    def _make_comment_json(self, comment, english_name):
        hebrew = comment["he"]
        english = comment["text"]
        if hebrew == english:
            # Fix an issue where sometimes Sefaria returns the exact same text. For now, safe to
            # assume that the equivalent text is Hebrew.
            # TODO: this may no longer happen anymore
            english = ""

        hebrew = reformat_hebrew_small_text(hebrew)
        hebrew = bold_diburei_hamatchil(hebrew, english_name)
        english = sanitize_sefaria_links(english)
        if english_name == "Jastrow":
            english = reformat_jastrow(english)

        return {
            "he": hebrew,
            "en": english,
            "ref": comment["ref"],
            "sourceRef": comment["sourceRef"],
            "sourceHeRef": comment["sourceHeRef"],
        }


_COMMENTARIES = [
    {
        "englishName": "Translation",
    },
    {
        "englishName": "Verses",
        "category": "Tanakh",
    },
    {
        "englishName": "Mishnah",
        "category": "Mishnah",
    },
    {
        "englishName": "Tosefta",
        "englishNamePattern": re.compile("^Tosefta "),
    },
    {
        "englishName": "Rashi",
    },
    {
        "englishName": "Tosafot",
    },
    {
        "englishName": "Ramban",
    },
    {
        "englishName": "Rashba",
    },
    {
        "englishName": "Maharsha",
        "englishNamePattern": re.compile("(Chidushei Halachot|Chidushei Agadot)"),
    },
    {
        "englishName": "Maharshal",
        "englishNamePattern": re.compile("(Chokhmat Shlomo on .*|Chokhmat Shlomo)"),
    },
    {
        "englishName": "Rosh",
        "englishNamePattern": re.compile("^Rosh on "),
    },
    {
        "englishName": "Ritva",
    },
    {
        "englishName": "Rav Nissim Gaon",
        "englishNamePattern": re.compile("^Rav Nissim Gaon on "),
    },
    {
        "englishName": "Shulchan Arukh",
        "englishNamePattern": re.compile("^Shulchan Arukh, "),
    },
    {
        "englishName": "Mishneh Torah",
        "englishNamePattern": re.compile("^Mishneh Torah, "),
    },
    #  {
    #    "englishName": "Sefer Mitzvot Gadol",
    #  },
    {
        "englishName": "Mesorat Hashas",
        "type": "mesorat hashas",
    },
    {
        "englishName": "Jastrow",
    },
    {
        "englishName": "Steinsaltz",
    }
];

def _has_matching_property(first, second, property_name):
    return property_name in first and \
        property_name in second and \
        first[property_name] == second[property_name]

def _matching_commentary_kind(comment):
    name = comment["collectiveTitle"]["en"]
    for kind in _COMMENTARIES:
        if name == kind["englishName"] or \
           _has_matching_property(comment, kind, "category") or \
           _has_matching_property(comment, kind, "type") or \
           "englishNamePattern" in kind and kind["englishNamePattern"].findall(name):
            return kind
