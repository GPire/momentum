"""Local AEAT document comparison. Certificates stay local; no app status mutation."""
import argparse
import base64
import getpass
import hashlib
import http.client
import json
import re
import ssl
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SOAP = 'http://schemas.xmlsoap.org/soap/envelope/'
BASE = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/kata/apli/ws/'
RESPONSE_NS = BASE+'cotejo_response_int_V1.xsd'
MAX = 20_000_000


def request_xml(csv):
    if not re.fullmatch(r'[A-Za-z0-9]{16}', csv):
        raise ValueError('CSV must contain 16 ASCII letters or digits')
    return (f'<s:Envelope xmlns:s="{SOAP}" xmlns:c="{BASE}cotejo_request_int_V1.xsd"><s:Body><c:peticionDocumento><c:CSV>{csv}</c:CSV><c:ENI>N</c:ENI></c:peticionDocumento></s:Body></s:Envelope>').encode()


def one(parent, name, namespace=RESPONSE_NS, required=True):
    nodes = parent.findall('{'+namespace+'}'+name)
    if len(nodes) > 1 or (required and not nodes):
        raise ValueError('Missing or ambiguous response field')
    return nodes[0] if nodes else None


def compare_response(xml, original):
    if len(xml) > MAX or b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper() or b'\x00' in xml:
        raise ValueError('Unsupported response')
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as error:
        raise ValueError('Invalid XML response') from error
    if root.tag != '{'+SOAP+'}Envelope':
        raise ValueError('Unexpected SOAP response')
    body = one(root, 'Body', SOAP)
    if len(body) != 1 or body[0].tag != '{'+RESPONSE_NS+'}cotejoResponse':
        raise ValueError('Unexpected result or SOAP fault')
    result = body[0]
    code_node = one(one(result, 'mensajeSalida'), 'codigo')
    if len(code_node):
        raise ValueError('Invalid status')
    code = (code_node.text or '').strip()
    report = {'code': code, 'identical': False, 'originalSha256': hashlib.sha256(original).hexdigest()}
    if code != '1':
        return report
    document = one(result, 'documento', required=False)
    binary = one(document, 'binario', required=False) if document is not None else None
    if binary is None:
        return report
    if len(binary):
        raise ValueError('Invalid document binary')
    decoded = base64.b64decode(re.sub(r'\s+', '', binary.text or ''), validate=True)
    if not decoded:
        raise ValueError('Empty document')
    return {**report, 'identical': decoded == original, 'returnedSha256': hashlib.sha256(decoded).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('original', type=Path)
    parser.add_argument('--cert', required=True, help='Local PEM certificate chain')
    parser.add_argument('--key', required=True, help='Local PEM private key; never uploaded')
    parser.add_argument('--seal', action='store_true', help='Use certificate-of-seal endpoint')
    parser.add_argument('--production', action='store_true', help='Explicitly use real AEAT service; default is test')
    args = parser.parse_args()
    with args.original.open('rb') as stream:
        original = stream.read(MAX+1)
    if not original or len(original) > MAX:
        raise ValueError('Original missing or too large')
    payload = request_xml(getpass.getpass('CSV (hidden, not stored): ').strip())
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(args.cert, args.key, password=lambda: getpass.getpass('Private key password: '))
    host = ('www10' if args.seal else 'www1')+'.agenciatributaria.gob.es' if args.production else ('prewww10' if args.seal else 'prewww1')+'.aeat.es'
    connection = http.client.HTTPSConnection(host, timeout=30, context=context)
    try:
        connection.request('POST', '/wlpl/KATA-APLI/CotejoInternetV1SOAP', body=payload, headers={'Content-Type':'text/xml; charset=utf-8','SOAPAction':'""'})
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError(f'AEAT HTTP {response.status}; no redirect or retry performed')
        report = compare_response(response.read(MAX+1), original)
    finally:
        connection.close()
    print(json.dumps({**report, 'source':host, 'environment':'production' if args.production else 'test', 'checkedAt':datetime.now(timezone.utc).isoformat(), 'productionSourceMatch':bool(args.production and report['identical']), 'legalPreservationVerified':False, 'fiscalCorrectnessVerified':False}))
    return 0 if args.production and report['identical'] else 2


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        # Do not log server documents, CSVs, certificate contents or exception payloads.
        print('Verification failed: '+type(error).__name__, file=sys.stderr)
        sys.exit(1)
