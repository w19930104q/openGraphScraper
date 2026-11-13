import type { MediaAccumulator, MediaClass, MediaFieldName } from './types';
/**
 * maps a media meta tag field name to the media class it belongs to.
 * field names outside of the grouped media tags return undefined.
 */
declare const fieldNameToMediaClass: Record<MediaFieldName, MediaClass>;
/** type guard: whether a field name is one of the grouped media meta tags */
export declare const isMediaFieldName: (fieldName: string) => fieldName is MediaFieldName;
declare const createMediaCollector: () => MediaAccumulator;
/**
 * Collects a single media meta tag into the matching grouped media object.
 *
 * Root tags (ex: `og:image`/`og:image:url`) always start a new object, even
 * when their content is empty, so an empty root still cuts off the previous
 * object. Structured properties (ex: `og:image:width`) only belong to the most
 * recent object of their own media class; properties appearing before any root
 * of that class are ignored.
 *
 * @param {object} collector - the in progress media accumulator
 * @param {string} fieldName - internal field name of the meta tag
 * @param {string} content - content/value attribute of the meta tag
 * @return {object} the updated media accumulator
 */
export declare function collectMediaTag(collector: MediaAccumulator, fieldName: MediaFieldName, content: string): MediaAccumulator;
export { createMediaCollector, fieldNameToMediaClass };
