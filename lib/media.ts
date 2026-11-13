import fields from './fields';
import { removeNestedUndefinedValues } from './utils';
import type {
  ImageObject,
  MusicSongObject,
  OgObjectInternal,
  TwitterImageObject,
  TwitterPlayerObject,
  VideoObject,
} from './types';

const mediaMapperTwitterImage = (item: TwitterImageObject[]) => ({
  alt: item[3],
  height: item[2],
  url: item[0],
  width: item[1],
});

const mediaMapperTwitterPlayer = (item: TwitterPlayerObject[]) => ({
  height: item[2],
  stream: item[3],
  url: item[0],
  width: item[1],
});

const mediaMapperMusicSong = (item: MusicSongObject[]) => ({
  disc: item[2],
  track: item[1],
  url: item[0],
});

const mediaMapper = (item: ImageObject[] | VideoObject[]) => ({
  height: item[2],
  type: item[3],
  url: item[0],
  width: item[1],
  alt: item[4],
});

const mediaSorter = (
  a: ImageObject | TwitterImageObject | VideoObject | TwitterPlayerObject,
  b: ImageObject | TwitterImageObject | VideoObject | TwitterPlayerObject,
) => {
  if (!(a.url && b.url)) {
    return 0;
  }

  const aRes = a.url.match(/\.(\w{2,5})$/);
  const aExt = (aRes?.[1].toLowerCase()) ?? null;
  const bRes = b.url.match(/\.(\w{2,5})$/);
  const bExt = (bRes?.[1].toLowerCase()) ?? null;

  if (aExt === 'gif' && bExt !== 'gif') {
    return -1;
  } if (aExt !== 'gif' && bExt === 'gif') {
    return 1;
  }
  return Math.max(b.width ?? 0, b.height ?? 0) - Math.max(a.width ?? 0, a.height ?? 0);
};

const mediaSorterMusicSong = (a: MusicSongObject, b: MusicSongObject) => {
  if (!(a.track && b.track)) {
    return 0;
  } if ((a.disc ?? 0) > (b.disc ?? 0)) {
    return 1;
  } if ((a.disc ?? 0) < (b.disc ?? 0)) {
    return -1;
  }
  return a.track - b.track;
};

// lodash zip replacement
const zip = (array: any, ...args: any) => {
  if (array === undefined) return [];
  return array
    .map((value: any, idx: number) => [value, ...args.map((arr: []) => arr[idx])]);
};

type MediaFamilyName = 'musicSong' | 'ogImage' | 'ogVideo';

type MediaItemFieldName =
  'musicSongDisc'
  | 'musicSongProperty'
  | 'musicSongTrack'
  | 'ogImageAlt'
  | 'ogImageHeight'
  | 'ogImageProperty'
  | 'ogImageSecureURL'
  | 'ogImageType'
  | 'ogImageWidth'
  | 'ogVideoHeight'
  | 'ogVideoProperty'
  | 'ogVideoType'
  | 'ogVideoWidth';

type MediaItem = Partial<Record<MediaItemFieldName, string>>;

// meta properties that start a new media item, in order of appearance
const mediaRootProperties: Record<string, { family: MediaFamilyName; fieldName: MediaItemFieldName }> = {
  'music:song': { family: 'musicSong', fieldName: 'musicSongProperty' },
  'music:song:url': { family: 'musicSong', fieldName: 'musicSongProperty' },
  'og:image': { family: 'ogImage', fieldName: 'ogImageProperty' },
  'og:image:url': { family: 'ogImage', fieldName: 'ogImageProperty' },
  'og:video': { family: 'ogVideo', fieldName: 'ogVideoProperty' },
  'og:video:url': { family: 'ogVideo', fieldName: 'ogVideoProperty' },
};

// meta properties that belong to the most recent media item of the same family
const mediaChildProperties: Record<string, { family: MediaFamilyName; fieldName: MediaItemFieldName }> = {
  'music:song:disc': { family: 'musicSong', fieldName: 'musicSongDisc' },
  'music:song:track': { family: 'musicSong', fieldName: 'musicSongTrack' },
  'og:image:alt': { family: 'ogImage', fieldName: 'ogImageAlt' },
  'og:image:height': { family: 'ogImage', fieldName: 'ogImageHeight' },
  'og:image:secure_url': { family: 'ogImage', fieldName: 'ogImageSecureURL' },
  'og:image:type': { family: 'ogImage', fieldName: 'ogImageType' },
  'og:image:width': { family: 'ogImage', fieldName: 'ogImageWidth' },
  'og:video:height': { family: 'ogVideo', fieldName: 'ogVideoHeight' },
  'og:video:type': { family: 'ogVideo', fieldName: 'ogVideoType' },
  'og:video:width': { family: 'ogVideo', fieldName: 'ogVideoWidth' },
};

const mediaItemFieldNames: Record<MediaFamilyName, MediaItemFieldName[]> = {
  musicSong: ['musicSongProperty', 'musicSongTrack', 'musicSongDisc'],
  ogImage: ['ogImageProperty', 'ogImageSecureURL', 'ogImageWidth', 'ogImageHeight', 'ogImageType', 'ogImageAlt'],
  ogVideo: ['ogVideoProperty', 'ogVideoWidth', 'ogVideoHeight', 'ogVideoType'],
};

/**
 * creates a tracker that groups og:image/og:video/music:song meta tags into
 * media items based on the order the tags appear in the document
 *
 * @return {object} tracker with addMetaTag/applyTo methods
 *
 */
export function mediaTracker() {
  const items: Record<MediaFamilyName, MediaItem[]> = { musicSong: [], ogImage: [], ogVideo: [] };
  const currentItemIndex: Record<MediaFamilyName, number> = { musicSong: -1, ogImage: -1, ogVideo: -1 };

  return {
    /**
     * adds a meta tag to the tracker
     *
     * @param {string} property - the meta tag property/name
     * @param {string} content - the meta tag content
     * @return {boolean} true when the meta tag is an og media tag
     *
     */
    addMetaTag(property: string, content: string): boolean {
      const root = mediaRootProperties[property.toLowerCase()];
      if (root) {
        // every root starts a new item, so an empty root severs the previous item
        items[root.family].push({ [root.fieldName]: content });
        currentItemIndex[root.family] = items[root.family].length - 1;
        return true;
      }
      const child = mediaChildProperties[property.toLowerCase()];
      if (child) {
        const item = items[child.family][currentItemIndex[child.family]];
        // child properties only belong to the most recent root of the same
        // family, orphans are ignored and the first value of an item wins
        if (item && item[child.fieldName] === undefined) {
          item[child.fieldName] = content;
        }
        return true;
      }
      return false;
    },

    /**
     * writes the tracked media items onto the ogObject as aligned arrays
     *
     * @param {object} ogObject - the current ogObject
     *
     */
    applyTo(ogObject: OgObjectInternal) {
      (Object.keys(items) as MediaFamilyName[]).forEach((family) => {
        if (items[family].length === 0) return;
        mediaItemFieldNames[family].forEach((fieldName) => {
          if (items[family].some((item) => item[fieldName] !== undefined)) {
            ogObject[fieldName] = items[family].map((item) => item[fieldName]) as string[];
          }
        });
      });
    },
  };
}

/**
 * formats the multiple media values
 *
 * @param {object} ogObject - the current ogObject
 * @param {object} options - options for ogs
 * @return {object} object with ogs results with updated media values
 *
 */
export function mediaSetup(ogObject: OgObjectInternal) {
  // sets ogImage property/width/height/type to empty array if one these exists
  if (
    ogObject.ogImageSecureURL
    ?? ogObject.ogImageURL
    ?? ogObject.ogImageProperty
    ?? ogObject.ogImageWidth
    ?? ogObject.ogImageHeight
    ?? ogObject.ogImageType
    ?? ogObject.ogImageAlt
  ) {
    ogObject.ogImageSecureURL = ogObject.ogImageSecureURL ? ogObject.ogImageSecureURL : [];
    ogObject.ogImageURL = ogObject.ogImageURL ? ogObject.ogImageURL : [];
    ogObject.ogImageProperty = ogObject.ogImageProperty ? ogObject.ogImageProperty : [];
    // fall back to ogImageURL if ogImageProperty isn't set
    ogObject.ogImageProperty = (ogObject.ogImageProperty.length !== 0) ? ogObject.ogImageProperty : ogObject.ogImageURL;
    // an og:image:secure_url only replaces the url of the image it belongs to
    // eslint-disable-next-line max-len
    ogObject.ogImageProperty = ogObject.ogImageProperty.map((url, index) => ogObject.ogImageSecureURL?.[index] ?? url);
    // fall back to ogImageSecureURL if there is no ogImageProperty/ogImageURL
    // eslint-disable-next-line max-len
    ogObject.ogImageProperty = (ogObject.ogImageProperty.length !== 0) ? ogObject.ogImageProperty : ogObject.ogImageSecureURL;
    ogObject.ogImageWidth = ogObject.ogImageWidth ? ogObject.ogImageWidth : [];
    ogObject.ogImageHeight = ogObject.ogImageHeight ? ogObject.ogImageHeight : [];
    ogObject.ogImageType = ogObject.ogImageType ? ogObject.ogImageType : [];
    ogObject.ogImageAlt = ogObject.ogImageAlt ? ogObject.ogImageAlt : [];
  }

  // format images and limit to 10
  const ogImages: ImageObject[] = zip(
    ogObject.ogImageProperty,
    ogObject.ogImageWidth,
    ogObject.ogImageHeight,
    ogObject.ogImageType,
    ogObject.ogImageAlt,
  )
    .map(mediaMapper)
    .filter((value:ImageObject) => value.url !== undefined && value.url !== '')
    .filter((value:ImageObject, index:number) => index < 10)
    .sort(mediaSorter);

  // sets ogVideo property/width/height/type to empty array if one these exists
  if (ogObject.ogVideoProperty ?? ogObject.ogVideoWidth ?? ogObject.ogVideoHeight ?? ogObject.ogVideoType) {
    ogObject.ogVideoProperty = ogObject.ogVideoProperty ? ogObject.ogVideoProperty : [];
    ogObject.ogVideoWidth = ogObject.ogVideoWidth ? ogObject.ogVideoWidth : [];
    ogObject.ogVideoHeight = ogObject.ogVideoHeight ? ogObject.ogVideoHeight : [];
    ogObject.ogVideoType = ogObject.ogVideoType ? ogObject.ogVideoType : [];
  }

  // format videos and limit to 10
  const ogVideos: VideoObject[] = zip(
    ogObject.ogVideoProperty,
    ogObject.ogVideoWidth,
    ogObject.ogVideoHeight,
    ogObject.ogVideoType,
  )
    .map(mediaMapper)
    .filter((value:VideoObject) => value.url !== undefined && value.url !== '')
    .filter((value:VideoObject, index:number) => index < 10)
    .sort(mediaSorter);

  // sets twitter image src/property/width/height/alt to empty array if one these exists
  if (
    ogObject.twitterImageSrc
    ?? ogObject.twitterImageProperty
    ?? ogObject.twitterImageWidth
    ?? ogObject.twitterImageHeight
    ?? ogObject.twitterImageAlt
  ) {
    ogObject.twitterImageSrc = ogObject.twitterImageSrc ? ogObject.twitterImageSrc : [];
    // eslint-disable-next-line max-len
    ogObject.twitterImageProperty = ogObject.twitterImageProperty ? ogObject.twitterImageProperty : ogObject.twitterImageSrc; // deafult to twitterImageSrc
    ogObject.twitterImageWidth = ogObject.twitterImageWidth ? ogObject.twitterImageWidth : [];
    ogObject.twitterImageHeight = ogObject.twitterImageHeight ? ogObject.twitterImageHeight : [];
    ogObject.twitterImageAlt = ogObject.twitterImageAlt ? ogObject.twitterImageAlt : [];
  }

  // format twitter images and limit to 10
  const twitterImages: TwitterImageObject[] = zip(
    ogObject.twitterImageProperty,
    ogObject.twitterImageWidth,
    ogObject.twitterImageHeight,
    ogObject.twitterImageAlt,
  )
    .map(mediaMapperTwitterImage)
    .filter((value:TwitterImageObject) => value.url !== undefined && value.url !== '')
    .filter((value:TwitterImageObject, index:number) => index < 10)
    .sort(mediaSorter);

  // sets twitter property/width/height/stream to empty array if one these exists
  if (ogObject.twitterPlayerProperty
    ?? ogObject.twitterPlayerWidth
    ?? ogObject.twitterPlayerHeight
    ?? ogObject.twitterPlayerStream
  ) {
    ogObject.twitterPlayerProperty = ogObject.twitterPlayerProperty ? ogObject.twitterPlayerProperty : [];
    ogObject.twitterPlayerWidth = ogObject.twitterPlayerWidth ? ogObject.twitterPlayerWidth : [];
    ogObject.twitterPlayerHeight = ogObject.twitterPlayerHeight ? ogObject.twitterPlayerHeight : [];
    ogObject.twitterPlayerStream = ogObject.twitterPlayerStream ? ogObject.twitterPlayerStream : [];
  }

  // format twitter player and limit to 10
  const twitterPlayers: TwitterPlayerObject[] = zip(
    ogObject.twitterPlayerProperty,
    ogObject.twitterPlayerWidth,
    ogObject.twitterPlayerHeight,
    ogObject.twitterPlayerStream,
  ).map(mediaMapperTwitterPlayer)
    .filter((value:TwitterPlayerObject) => value.url !== undefined && value.url !== '')
    .filter((value:TwitterPlayerObject, index:number) => index < 10)
    .sort(mediaSorter);

  // sets music property/songTrack/songDisc to empty array if one these exists
  if (ogObject.musicSongProperty ?? ogObject.musicSongTrack ?? ogObject.musicSongDisc ?? ogObject.musicSongUrl) {
    ogObject.musicSongUrl = ogObject.musicSongUrl ? ogObject.musicSongUrl : [];
    ogObject.musicSongProperty = ogObject.musicSongProperty ? ogObject.musicSongProperty : ogObject.musicSongUrl; // deafult to musicSongUrl
    ogObject.musicSongTrack = ogObject.musicSongTrack ? ogObject.musicSongTrack : [];
    ogObject.musicSongDisc = ogObject.musicSongDisc ? ogObject.musicSongDisc : [];
  }

  // format music songs and limit to 10
  const musicSongs: MusicSongObject[] = zip(ogObject.musicSongProperty, ogObject.musicSongTrack, ogObject.musicSongDisc)
    .map(mediaMapperMusicSong)
    .filter((value:MusicSongObject) => value.url !== undefined && value.url !== '')
    .filter((value:MusicSongObject, index:number) => index < 10)
    .sort(mediaSorterMusicSong);

  // remove old values since everything will live under the main property
  fields.filter((item) => (item.multiple && item.fieldName?.match('(ogImage|ogVideo|twitter|musicSong).*')))
    .forEach((item) => {
      delete ogObject[item.fieldName];
    });

  if (ogImages.length) ogObject.ogImage = ogImages;
  if (ogVideos.length) ogObject.ogVideo = ogVideos;
  if (twitterImages.length) ogObject.twitterImage = twitterImages;
  if (twitterPlayers.length) ogObject.twitterPlayer = twitterPlayers;
  if (musicSongs.length) ogObject.musicSong = musicSongs;

  // removes any undefs
  ogObject = removeNestedUndefinedValues(ogObject);

  return ogObject;
}

export default mediaSetup;
