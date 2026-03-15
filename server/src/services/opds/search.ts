import { create } from 'xmlbuilder2';
import {
  OPENSEARCH_NS,
  ACQUISITION_TYPE,
} from '@opds/shared';

// ---------------------------------------------------------------------------
// OpenSearch description document
// ---------------------------------------------------------------------------

/**
 * Build an OpenSearch description XML document that tells OPDS clients
 * how to perform search queries against this server.
 *
 * Conforms to the OpenSearch 1.1 specification.
 * @see http://www.opensearch.org/Specifications/OpenSearch/1.1
 */
export function buildOpenSearchDescription(baseUrl: string): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(OPENSEARCH_NS, 'OpenSearchDescription')
      .att('xmlns', OPENSEARCH_NS);

  doc.ele(OPENSEARCH_NS, 'ShortName').txt('OPDS Search');
  doc.ele(OPENSEARCH_NS, 'Description').txt('Search the comic library');
  doc.ele(OPENSEARCH_NS, 'InputEncoding').txt('UTF-8');
  doc.ele(OPENSEARCH_NS, 'OutputEncoding').txt('UTF-8');

  doc.ele(OPENSEARCH_NS, 'Url')
    .att('type', ACQUISITION_TYPE)
    .att('template', `${baseUrl}/opds/search?q={searchTerms}`);

  return doc.end({ prettyPrint: true });
}
