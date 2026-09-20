import base64
import unittest
from aeat_cotejo import compare_response, request_xml, RESPONSE_NS, SOAP


def response(code='1', document=b'original'):
    binary = '' if document is None else '<r:documento><r:binario>'+base64.b64encode(document).decode()+'</r:binario></r:documento>'
    return (f'<s:Envelope xmlns:s="{SOAP}" xmlns:r="{RESPONSE_NS}"><s:Body><r:cotejoResponse>{binary}<r:mensajeSalida><r:codigo>{code}</r:codigo><r:descripcion>TEST</r:descripcion></r:mensajeSalida></r:cotejoResponse></s:Body></s:Envelope>').encode()


class CotejoTests(unittest.TestCase):
    def test_exact_comparison(self):
        self.assertTrue(compare_response(response(), b'original')['identical'])
        self.assertFalse(compare_response(response(), b'changed')['identical'])

    def test_errors_never_match(self):
        for code in ['2', '3', '4', '5', '6', '7', '8', '100', '999']:
            self.assertFalse(compare_response(response(code), b'original')['identical'])
        self.assertFalse(compare_response(response(document=None), b'original')['identical'])

    def test_reject_ambiguous_or_hostile_xml(self):
        for xml in [b'<!DOCTYPE x>'+response(), response().replace(b'<r:codigo>1</r:codigo>', b'<r:codigo>1</r:codigo><r:codigo>1</r:codigo>'), response().replace(b'cotejoResponse', b'wrong'), response().replace(b'b3JpZ2luYWw=', b'%%%'), b'x'*20_000_001]:
            with self.assertRaises(ValueError):
                compare_response(xml, b'original')

    def test_request_validation(self):
        self.assertIn(b'<c:ENI>N</c:ENI>', request_xml('A'*16))
        for csv in ['', 'short', '<'*16, 'A'*17]:
            with self.assertRaises(ValueError):
                request_xml(csv)


if __name__ == '__main__':
    unittest.main()
