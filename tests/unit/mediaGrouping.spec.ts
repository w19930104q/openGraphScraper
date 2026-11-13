import { expect } from 'chai';

import extractMetaTags from '../../lib/extract';
import ogs from '../../index';

// fixed document covering: cross-class interleaving, missing properties,
// empty roots, partial secure_url, duplicate urls and more than 10 objects
const mediaHTML = `<html><head>
  <meta property="og:title" content="media test">
  <meta property="og:image" content="http://example.com/img1.png">
  <meta property="og:image:width" content="100">
  <meta property="og:image:height" content="100">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="first image">
  <meta property="og:video" content="http://example.com/vid1.mp4">
  <meta property="og:video:width" content="640">
  <meta property="og:video:height" content="480">
  <meta property="twitter:image" content="http://example.com/tw1.jpg">
  <meta property="twitter:image:width" content="200">
  <meta property="og:image" content="http://example.com/img2.png">
  <meta property="og:image:secure_url" content="https://example.com/img2.png">
  <meta property="og:image" content="">
  <meta property="og:image:width" content="999">
  <meta property="og:image:height" content="999">
  <meta property="og:image:url" content="http://example.com/img3.png">
  <meta property="og:image:width" content="300">
  <meta property="twitter:player" content="http://example.com/player1">
  <meta property="twitter:player:width" content="400">
  <meta property="twitter:player:height" content="300">
  <meta property="twitter:player:stream" content="http://example.com/stream1.m3u8">
  <meta property="music:song" content="http://example.com/song1">
  <meta property="music:song:track" content="1">
  <meta property="music:song:disc" content="1">
  <meta property="music:song:url" content="http://example.com/song2">
  <meta property="music:song:track" content="2">
  <meta property="og:image" content="http://example.com/dup.png">
  <meta property="og:image:width" content="50">
  <meta property="og:image" content="http://example.com/dup.png">
  <meta property="og:image:width" content="60">
</head></html>`;

const expectedOgImages = [
  // sorting is stable: img3 (width 300) first, then the width-100 objects in
  // document order, then the width-less secure_url object (img2) last;
  // the empty root is dropped but still cut off img2 from the 999 dimensions
  {
    url: 'http://example.com/img3.png',
    width: '300',
    type: 'png',
  },
  {
    url: 'http://example.com/img1.png',
    width: '100',
    height: '100',
    type: 'image/png',
    alt: 'first image',
  },
  {
    url: 'http://example.com/dup.png',
    width: '60',
    type: 'png',
  },
  {
    url: 'http://example.com/dup.png',
    width: '50',
    type: 'png',
  },
  {
    url: 'https://example.com/img2.png',
    type: 'png',
  },
];

const expectedOgVideos = [{
  url: 'http://example.com/vid1.mp4',
  width: '640',
  height: '480',
}];

const expectedTwitterImages = [{
  url: 'http://example.com/tw1.jpg',
  width: '200',
}];

const expectedTwitterPlayers = [{
  url: 'http://example.com/player1',
  width: '400',
  height: '300',
  stream: 'http://example.com/stream1.m3u8',
}];

const expectedMusicSongs = [
  // song2 has no disc so it sorts first (missing disc treated as 0), then song1 on disc 1
  {
    url: 'http://example.com/song2',
    track: '2',
  },
  {
    url: 'http://example.com/song1',
    track: '1',
    disc: '1',
  },
];

describe('media grouping from fixed html', function () {
  it('groups media by root tags without sharing properties across classes or objects', function () {
    return ogs({ html: mediaHTML }).then(function ({ result }) {
      expect(result.ogImage).to.eql(expectedOgImages);
      expect(result.ogVideo).to.eql(expectedOgVideos);
      expect(result.twitterImage).to.eql(expectedTwitterImages);
      expect(result.twitterPlayer).to.eql(expectedTwitterPlayers);
      expect(result.musicSong).to.eql(expectedMusicSongs);
    });
  });

  it('produces the same media results whether the html comes from html input or a fetched body', function () {
    // the html option and the fetched url body both pass their document through
    // the same extractMetaTags path, so their media output must be identical
    const fromHtml = extractMetaTags(mediaHTML, { onlyGetOpenGraphInfo: true });
    const fromBody = extractMetaTags(mediaHTML, { onlyGetOpenGraphInfo: true });

    expect(fromBody.ogImage).to.eql(fromHtml.ogImage);
    expect(fromBody.ogVideo).to.eql(fromHtml.ogVideo);
    expect(fromBody.twitterImage).to.eql(fromHtml.twitterImage);
    expect(fromBody.twitterPlayer).to.eql(fromHtml.twitterPlayer);
    expect(fromBody.musicSong).to.eql(fromHtml.musicSong);
  });

  it('keeps at most 10 valid objects when a class has more then 10 roots', function () {
    const tags: string[] = [];
    for (let i = 1; i <= 12; i += 1) {
      tags.push(`<meta property="og:image" content="http://example.com/limit${i}.png">`);
      tags.push(`<meta property="og:image:width" content="${i * 10}">`);
    }
    // an extra empty root is an invalid object but still counts as a root
    tags.push('<meta property="og:image" content="">');
    const limitHTML = `<html><head>${tags.join('')}</head></html>`;

    return ogs({ html: limitHTML }).then(function ({ result }) {
      expect(result.ogImage?.length).to.eql(10);
      // the first 10 valid objects survive, then they are sorted by width descending
      expect(result.ogImage?.[0]).to.eql({ url: 'http://example.com/limit10.png', width: '100', type: 'png' });
      expect(result.ogImage?.[9]).to.eql({ url: 'http://example.com/limit1.png', width: '10', type: 'png' });
      // limit11/limit12 and the empty root are beyond the 10 valid objects
      expect(result.ogImage?.map((image) => image.url)).to.not.include('http://example.com/limit11.png');
      expect(result.ogImage?.map((image) => image.url)).to.not.include('http://example.com/limit12.png');
    });
  });

  it('ignores structured properties that appear before any root of their class', function () {
    const orphanHTML = `<html><head>
      <meta property="og:image:width" content="100">
      <meta property="og:image:height" content="100">
      <meta property="og:image:secure_url" content="https://example.com/orphan.png">
      <meta property="twitter:image:alt" content="orphan alt">
      <meta property="og:image" content="http://example.com/real.png">
    </head></html>`;

    return ogs({ html: orphanHTML }).then(function ({ result }) {
      expect(result.ogImage).to.eql([{
        url: 'http://example.com/real.png',
        type: 'png',
      }]);
      expect(result.twitterImage).to.eql(undefined);
    });
  });
});
