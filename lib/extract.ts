import { load } from 'cheerio';

import fallback from './fallback';
import fields from './fields';
import { collectMediaTag, createMediaCollector, isMediaFieldName } from './mediaCollector';
import mediaSetup from './media';
import { unescapeScriptText } from './utils';

import type { OgObjectInternal, OpenGraphScraperOptions } from './types';

/**
 * extract all of the meta tags needed for ogs
 *
 * @param {sting} body - the body of the fetch request
 * @param {object} options - options for ogs
 * @return {object} object with ogs results
 *
 */
export default function extractMetaTags(body: string, options: OpenGraphScraperOptions) {
  let ogObject: OgObjectInternal = { success: true };
  const $ = load(body);
  const metaFields = fields;
  const mediaCollector = createMediaCollector();

  // find all of the open graph info in the meta tags
  $('meta').each((index, meta) => {
    if (!meta.attribs || (!meta.attribs.property && !meta.attribs.name)) return;
    const property = meta.attribs.property || meta.attribs.name;
    const content: any = meta.attribs.content || meta.attribs.value;
    metaFields.forEach((item) => {
      if (item && property.toLowerCase() === item.property.toLowerCase()) {
        // grouped media values (og:image/og:video/twitter:image/twitter:player/music:song)
        // are collected into objects split by their root meta tags
        if (isMediaFieldName(item.fieldName)) {
          collectMediaTag(mediaCollector, item.fieldName, content);
        } else {
          ogObject[item.fieldName] = content;
        }
      }
    });

    if (options.customMetaTags) {
      options.customMetaTags.forEach((item) => {
        if (!ogObject.customMetaTags) ogObject.customMetaTags = {};
        if (item && property.toLowerCase() === item.property.toLowerCase()) {
          if (!item.multiple) {
            ogObject.customMetaTags[item.fieldName] = content;
          } else if (!ogObject.customMetaTags[item.fieldName]) {
            ogObject.customMetaTags[item.fieldName] = [content];
          } else if (Array.isArray(ogObject.customMetaTags[item.fieldName])) {
            ogObject.customMetaTags[item.fieldName] = [
              ...ogObject.customMetaTags[item.fieldName],
              content,
            ];
          }
        }
      });
      if (ogObject.customMetaTags && Object.keys(ogObject.customMetaTags).length === 0) delete ogObject.customMetaTags;
    }
  });

  ogObject.mediaCollector = mediaCollector;

  // formats the multiple media values
  ogObject = mediaSetup(ogObject);

  // if onlyGetOpenGraphInfo isn't set, run the open graph fallbacks
  if (!options.onlyGetOpenGraphInfo || Array.isArray(options.onlyGetOpenGraphInfo)) {
    ogObject = fallback(ogObject, options, $, body);

    $('script').each((index, script) => {
      if (script.attribs.type && script.attribs.type === 'application/ld+json') {
        if (!ogObject.jsonLD) ogObject.jsonLD = [];
        let scriptText = $(script).text().trim();
        if (scriptText) {
          scriptText = scriptText.replace(/(\r\n|\n|\r)/gm, ''); // remove newlines
          scriptText = unescapeScriptText(scriptText);
          try {
            ogObject.jsonLD.push(JSON.parse(scriptText));
          } catch (error: unknown) {
            if (options.jsonLDOptions?.logOnJSONParseError) {
              console.error('Error parsing JSON-LD script tag:', error);
            }
            if (options.jsonLDOptions?.throwOnJSONParseError) {
              throw error;
            }
          }
        }
      }
    });
  }

  return ogObject;
}
