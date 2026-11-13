import { removeNestedUndefinedValues } from './utils';
import type {
  CollectedMediaObject,
  ImageObject,
  MediaAccumulator,
  MusicSongObject,
  OgObjectInternal,
  TwitterImageObject,
  TwitterPlayerObject,
  VideoObject,
} from './types';

const mediaSorter = (
  a: CollectedMediaObject,
  b: CollectedMediaObject,
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
  return Math.max(Number(b.width) || 0, Number(b.height) || 0)
    - Math.max(Number(a.width) || 0, Number(a.height) || 0);
};

const mediaSorterMusicSong = (a: CollectedMediaObject, b: CollectedMediaObject) => {
  if (!(a.track && b.track)) {
    return 0;
  }
  const aDisc = Number(a.disc) || 0;
  const bDisc = Number(b.disc) || 0;
  if (aDisc > bDisc) {
    return 1;
  } if (aDisc < bDisc) {
    return -1;
  }
  return Number(a.track) - Number(b.track);
};

/**
 * turns the grouped media objects into the final output arrays: drops objects
 * without a usable url, keeps at most 10 valid objects and applies the sorter.
 *
 * @param {array} mediaObjects - grouped objects collected in document order
 * @param {function} sorter - sort rule for this media class
 * @return {array} formatted media objects, limited to 10 and sorted
 */
const formatMediaObjects = (
  mediaObjects: CollectedMediaObject[],
  sorter?: (a: CollectedMediaObject, b: CollectedMediaObject) => number,
): CollectedMediaObject[] => {
  const validObjects = mediaObjects
    .filter((value) => value.url !== undefined && value.url !== '');

  const limitedObjects = validObjects
    .filter((value, index) => index < 10);

  return sorter ? [...limitedObjects].sort(sorter) : limitedObjects;
};

/**
 * formats the multiple media values
 *
 * @param {object} ogObject - the current ogObject
 * @return {object} object with ogs results with updated media values
 *
 */
export function mediaSetup(ogObject: OgObjectInternal) {
  const collector: MediaAccumulator = ogObject.mediaCollector ?? {
    ogImage: [],
    ogVideo: [],
    twitterImage: [],
    twitterPlayer: [],
    musicSong: [],
  };

  // format each media class and limit to 10 valid objects
  const ogImages = formatMediaObjects(collector.ogImage, mediaSorter) as ImageObject[];
  const ogVideos = formatMediaObjects(collector.ogVideo, mediaSorter) as VideoObject[];
  const twitterImages = formatMediaObjects(collector.twitterImage, mediaSorter) as TwitterImageObject[];
  const twitterPlayers = formatMediaObjects(collector.twitterPlayer, mediaSorter) as TwitterPlayerObject[];
  const musicSongs = formatMediaObjects(collector.musicSong, mediaSorterMusicSong) as MusicSongObject[];

  // the collector was only needed while building the grouped media objects
  delete ogObject.mediaCollector;

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
