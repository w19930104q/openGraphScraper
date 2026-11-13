import type {
  MediaAccumulator,
  MediaClass,
  MediaFieldName,
} from './types';

interface MediaClassConfig {
  objectKey: keyof MediaAccumulator;
  /** field names that start a new media object (the "root" meta tags) */
  rootFields: MediaFieldName[];
  /** field names whose value replaces the current object's url */
  urlFields: MediaFieldName[];
}

const mediaClassConfigs: Record<MediaClass, MediaClassConfig> = {
  ogImage: {
    objectKey: 'ogImage',
    // both og:image and og:image:url start a new image object
    rootFields: ['ogImageProperty', 'ogImageURL'],
    // secure_url only replaces the url of the image it belongs to
    urlFields: ['ogImageProperty', 'ogImageURL', 'ogImageSecureURL'],
  },
  ogVideo: {
    objectKey: 'ogVideo',
    rootFields: ['ogVideoProperty'],
    urlFields: ['ogVideoProperty'],
  },
  twitterImage: {
    objectKey: 'twitterImage',
    rootFields: ['twitterImageProperty', 'twitterImageSrc'],
    urlFields: ['twitterImageProperty', 'twitterImageSrc'],
  },
  twitterPlayer: {
    objectKey: 'twitterPlayer',
    rootFields: ['twitterPlayerProperty'],
    urlFields: ['twitterPlayerProperty'],
  },
  musicSong: {
    objectKey: 'musicSong',
    rootFields: ['musicSongProperty', 'musicSongUrl'],
    urlFields: ['musicSongProperty', 'musicSongUrl'],
  },
};

/**
 * maps a media meta tag field name to the media class it belongs to.
 * field names outside of the grouped media tags return undefined.
 */
const fieldNameToMediaClass: Record<MediaFieldName, MediaClass> = {
  ogImageProperty: 'ogImage',
  ogImageURL: 'ogImage',
  ogImageSecureURL: 'ogImage',
  ogImageWidth: 'ogImage',
  ogImageHeight: 'ogImage',
  ogImageType: 'ogImage',
  ogImageAlt: 'ogImage',
  ogVideoProperty: 'ogVideo',
  ogVideoWidth: 'ogVideo',
  ogVideoHeight: 'ogVideo',
  ogVideoType: 'ogVideo',
  twitterImageProperty: 'twitterImage',
  twitterImageSrc: 'twitterImage',
  twitterImageWidth: 'twitterImage',
  twitterImageHeight: 'twitterImage',
  twitterImageAlt: 'twitterImage',
  twitterPlayerProperty: 'twitterPlayer',
  twitterPlayerWidth: 'twitterPlayer',
  twitterPlayerHeight: 'twitterPlayer',
  twitterPlayerStream: 'twitterPlayer',
  musicSongProperty: 'musicSong',
  musicSongUrl: 'musicSong',
  musicSongTrack: 'musicSong',
  musicSongDisc: 'musicSong',
};

const mediaFieldNames = Object.keys(fieldNameToMediaClass) as MediaFieldName[];

/** type guard: whether a field name is one of the grouped media meta tags */
export const isMediaFieldName = (fieldName: string): fieldName is MediaFieldName => (
  (mediaFieldNames as string[]).includes(fieldName)
);

const createMediaCollector = (): MediaAccumulator => ({
  ogImage: [],
  ogVideo: [],
  twitterImage: [],
  twitterPlayer: [],
  musicSong: [],
});

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
export function collectMediaTag(
  collector: MediaAccumulator,
  fieldName: MediaFieldName,
  content: string,
): MediaAccumulator {
  const mediaClass = fieldNameToMediaClass[fieldName];
  if (!mediaClass) return collector;

  const config = mediaClassConfigs[mediaClass];
  const mediaObjects = collector[config.objectKey];

  if (config.rootFields.includes(fieldName)) {
    // a root tag always starts a new object, even when the content is empty
    mediaObjects.push({ url: content });
    return collector;
  }

  // structured properties before any root tag of this class are ignored
  const currentObject = mediaObjects[mediaObjects.length - 1];
  if (!currentObject) return collector;

  if (config.urlFields.includes(fieldName)) {
    currentObject.url = content;
    return collector;
  }

  switch (fieldName) {
    case 'ogImageWidth':
    case 'ogVideoWidth':
    case 'twitterImageWidth':
    case 'twitterPlayerWidth':
      currentObject.width = content;
      break;
    case 'ogImageHeight':
    case 'ogVideoHeight':
    case 'twitterImageHeight':
    case 'twitterPlayerHeight':
      currentObject.height = content;
      break;
    case 'ogImageType':
    case 'ogVideoType':
      currentObject.type = content;
      break;
    case 'ogImageAlt':
    case 'twitterImageAlt':
      currentObject.alt = content;
      break;
    case 'twitterPlayerStream':
      currentObject.stream = content;
      break;
    case 'musicSongTrack':
      currentObject.track = content;
      break;
    case 'musicSongDisc':
      currentObject.disc = content;
      break;
    default:
      break;
  }

  return collector;
}

export { createMediaCollector, fieldNameToMediaClass };
