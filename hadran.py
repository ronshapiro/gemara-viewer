#!/usr/bin/python

from util.json_files import write_json
import json
import masechtot

_PATH = "precomputed_texts/hadran.json"

def hadran_sections(masechet):
    masechet = masechtot.MASECHTOT_BY_CANONICAL_NAME[masechet]
    with open(_PATH, "r") as f:
        return _process_sections(masechet, json.load(f)["sections"])


def _process_sections(masechet, sections):
    for section in sections:
        section["en"] = section["en"].replace("____", masechet.canonical_name)
        section["he"] = section["he"].replace(
            "<small>(יאמר שם המסכת)</small>", f"<strong>{masechet.vocalized_hebrew_name}</strong>")
    return sections


if __name__ == '__main__':
    from api_request_handler import AbstractApiRequestHandler
    from api_request_handler import RealRequestMaker

    class HadranRequestHandler(AbstractApiRequestHandler):

        async def _make_requests(self):
            return [await self._request_maker.make_request(
                "Hadran",
                "https://sefaria.org/api/texts",
                params=dict(commentary="1"),
            )]

        def _make_id(self):
            return "Hadran"

        def _make_sub_ref(self, main_ref, index):
            return f"Hadran {index + 1}"

        def _section_splitter(self):
            return " "

        def _post_process_section(self, section):
            section["en"] = section["en"].replace(" [fill in the name of the tractate]", "")
            section["he"] = (section["he"]
                             .replace("וְצֶאֱצָאֵינוּ", "וְצֶאֱצָאֵינוּ (וְצֶאֱצָאֵי צֶאֱצָאֵינוּ)")
                             .replace("-", " ").replace("  ", " ")
                             )
            return section

    write_json(_PATH, HadranRequestHandler(RealRequestMaker()).handle_request())
