import api_request_handler
import argparse
import json

def input_file_path(url):
    path = url[len("https://sefaria.org/"):].replace("/", "@")
    return f"test_data/api_request_handler/{path}.input.json"

class TestAmud(object):
    def __init__(self, masechet, amud):
        self.masechet = masechet
        self.amud = amud

    def __str__(self):
        return "TestAmud(masechet = %s, amud = %s)" % (self.masechet, self.amud)

    def output_file_path(self):
        return "test_data/api_request_handler/%s.%s.expected-output.json" % (
            self.masechet, self.amud)

test_amudim = (
    TestAmud("Berakhot", "2a"),
    # DO NOT SUBMIT
    TestAmud("Berakhot", "34b"),
    TestAmud("Shabbat", "100a"),
    #TestAmud("Eruvin", "11a"), # Has images
    #TestAmud("Eruvin", "6b"), # Has images, including a comment with multiple images
    #TestAmud("Niddah", "48b"),
    #TestAmud("Nazir", "33b"), # Has no gemara, just Tosafot
    #TestAmud("Shabbat", "74b"), # Has weird API response with nested comment text from Rosh
    #TestAmud("Tamid", "25b"), # No Rashi
)

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

class FakeRequestMaker(object):
    async def request_amud(self, url, **ignored_params):
        with open(input_file_path(url), "r") as input_file:
            return FakeResponse(input_file.read())


class FakeResponse(object):
    def __init__(self, text):
        self.text = text
        self.status_code = 200

    def json(self):
        return json.loads(self.text)

def doTest():
    request_handler = api_request_handler.ApiRequestHandler(FakeRequestMaker())
    for test_amud in test_amudim:
        # translating to, and then from, json normalizes things like python tuples -> json lists
        actual = json.loads(json.dumps(
            request_handler.amud_api_request(test_amud.masechet, test_amud.amud)))
        expected = json.loads(open(test_amud.output_file_path(), "r").read())
        if actual != expected:
            raise AssertionError("Not equal for %s" % test_amud)

def write_json(file_name, data):
    with open(file_name, "w") as output_file:
        json.dump(data,
                  output_file,
                  ensure_ascii = False,
                  indent = 2,
                  sort_keys = True)
        output_file.write("\n")

class RecordingRequestMaker(object):
    def __init__(self):
        self._real_request_maker = api_request_handler.RealRequestMaker()
        self.records = {}

    async def request_amud(self, url, **params):
        results = await self._real_request_maker.request_amud(url, **params)
        self.records[input_file_path(url)] = results.json()
        return results

    def write_json(self):
        for file_name, result in self.records.items():
            write_json(file_name, result)

def setup():
    request_maker = RecordingRequestMaker()
    request_handler = api_request_handler.ApiRequestHandler(request_maker)
    for test_amud in test_amudim:
        write_json(test_amud.output_file_path(),
                   request_handler.amud_api_request(test_amud.masechet, test_amud.amud))
    request_maker.write_json()

if args.setup:
    setup()
else:
    doTest()
