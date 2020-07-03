import html
import html.parser

class BaseHtmlTranslator(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self._out = []

    @classmethod
    def process(cls, str_or_list):
        if type(str_or_list) == str:
            return cls()._process_string(str_or_list)
        return tuple(map(cls.process, str_or_list))

    def _process_string(self, text):
        self.feed(text)
        return "".join(self._out)

    def append_start_tag(self, tag, attrs):
        self._out.append("<%s" % tag)
        for attr in attrs:
            self._out.append(f' {attr[0]}="{attr[1]}"')
        self._out.append(">")

    def append_end_tag(self, tag):
        self._out.append("</%s>" % tag)
