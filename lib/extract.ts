import { load } from 'cheerio';

import fallback from './fallback';
import fields from './fields';
import mediaSetup from './media';
import { unescapeScriptText } from './utils';

import type { OgObjectInternal, OpenGraphScraperOptions } from './types';

// structured og:image/og:video properties, grouped by document order.
// each root tag (og:image, og:image:url, og:video, og:video:url) starts a new
// group and every sub property that follows belongs to the most recent group
interface MediaGroup {
  alt?: string;
  height?: string;
  secureUrl?: string;
  type?: string;
  url?: string;
  width?: string;
}

const ogImageGroupProperties: Record<string, keyof MediaGroup> = {
  'og:image': 'url',
  'og:image:url': 'url',
  'og:image:alt': 'alt',
  'og:image:height': 'height',
  'og:image:secure_url': 'secureUrl',
  'og:image:type': 'type',
  'og:image:width': 'width',
};

const ogVideoGroupProperties: Record<string, keyof MediaGroup> = {
  'og:video': 'url',
  'og:video:url': 'url',
  'og:video:height': 'height',
  'og:video:type': 'type',
  'og:video:width': 'width',
};

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
  const ogImageGroups: MediaGroup[] = [];
  const ogVideoGroups: MediaGroup[] = [];

  // find all of the open graph info in the meta tags
  $('meta').each((index, meta) => {
    if (!meta.attribs || (!meta.attribs.property && !meta.attribs.name)) return;
    const property = meta.attribs.property || meta.attribs.name;
    const content: any = meta.attribs.content || meta.attribs.value;
    const lowerProperty = property.toLowerCase();
    const groupKey = ogImageGroupProperties[lowerProperty] ?? ogVideoGroupProperties[lowerProperty];
    if (groupKey) {
      const groups = ogImageGroupProperties[lowerProperty] ? ogImageGroups : ogVideoGroups;
      if (groupKey === 'url') {
        // a root tag always starts a new group, even when it has no content
        groups.push({ url: content });
      } else if (groups.length > 0) {
        // sub properties belong to the most recent group (last value wins);
        // orphan sub properties with no preceding root tag are ignored
        groups[groups.length - 1][groupKey] = content;
      }
    } else {
      metaFields.forEach((item) => {
        if (item && lowerProperty === item.property.toLowerCase()) {
          // check if fieldName is one of mediaMapperProperties
          if (
            item.fieldName === 'musicSongDisc'
            || item.fieldName === 'musicSongProperty'
            || item.fieldName === 'musicSongTrack'
            || item.fieldName === 'musicSongUrl'
            || item.fieldName === 'twitterImageAlt'
            || item.fieldName === 'twitterImageHeight'
            || item.fieldName === 'twitterImageProperty'
            || item.fieldName === 'twitterImageSrc'
            || item.fieldName === 'twitterImageWidth'
            || item.fieldName === 'twitterPlayerHeight'
            || item.fieldName === 'twitterPlayerProperty'
            || item.fieldName === 'twitterPlayerStream'
            || item.fieldName === 'twitterPlayerWidth'
          ) {
            if (!ogObject[item.fieldName]) {
              ogObject[item.fieldName] = [content];
            } else {
              ogObject[item.fieldName]?.push(content);
            }
          } else {
            ogObject[item.fieldName] = content;
          }
        }
      });
    }

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

  // flatten the groups into aligned arrays so mediaSetup can zip them by index
  // without values from one group shifting onto another
  if (ogImageGroups.length > 0) {
    ogObject.ogImageProperty = ogImageGroups.map((group) => group.url);
    ogObject.ogImageSecureURL = ogImageGroups.map((group) => group.secureUrl);
    ogObject.ogImageWidth = ogImageGroups.map((group) => group.width);
    ogObject.ogImageHeight = ogImageGroups.map((group) => group.height);
    ogObject.ogImageType = ogImageGroups.map((group) => group.type);
    ogObject.ogImageAlt = ogImageGroups.map((group) => group.alt);
  }

  if (ogVideoGroups.length > 0) {
    ogObject.ogVideoProperty = ogVideoGroups.map((group) => group.url);
    ogObject.ogVideoWidth = ogVideoGroups.map((group) => group.width);
    ogObject.ogVideoHeight = ogVideoGroups.map((group) => group.height);
    ogObject.ogVideoType = ogVideoGroups.map((group) => group.type);
  }

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
