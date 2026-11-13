import { expect } from 'chai';

import extractMetaTags from '../../lib/extract';

// fixed HTML fixtures for og:image/og:video group boundaries:
// every og:image/og:image:url (or og:video/og:video:url) tag starts a new group and
// the sub properties that follow belong to the most recent group only
describe('media grouping', function () {
  it('keeps sparse fields on their own image group', function () {
    // the first image has no width/height, the second one does - the second
    // image's values must not shift onto the first image
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image" content="http://test.com/two.png">
        <meta property="og:image:width" content="600">
        <meta property="og:image:height" content="400">
        <meta property="og:image:type" content="image/png">
        <meta property="og:image:alt" content="image two">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    expect(ogObject.ogImage).to.eql([{
      url: 'http://test.com/two.png',
      width: '600',
      height: '400',
      type: 'image/png',
      alt: 'image two',
    }, {
      url: 'http://test.com/one.png',
    }]);
  });

  it('starts a new group for og:image and og:image:url aliases and keeps secure_url in its own group', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image:url" content="http://test.com/two.png">
        <meta property="og:image:width" content="200">
        <meta property="og:image:secure_url" content="https://test.com/two.png">
        <meta property="og:image" content="http://test.com/three.png">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    // secure_url only replaces the url of the second group, the other groups are kept
    expect(ogObject.ogImage).to.eql([{
      url: 'https://test.com/two.png',
      width: '200',
    }, {
      url: 'http://test.com/one.png',
      width: '100',
    }, {
      url: 'http://test.com/three.png',
    }]);
  });

  it('keeps duplicate urls as separate groups with their own attributes', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image" content="http://test.com/dup.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image" content="http://test.com/dup.png">
        <meta property="og:image:width" content="200">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    expect(ogObject.ogImage).to.eql([{
      url: 'http://test.com/dup.png',
      width: '200',
    }, {
      url: 'http://test.com/dup.png',
      width: '100',
    }]);
  });

  it('does not mix image and video groups when tags are interleaved', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:video" content="http://test.com/video_one.mp4">
        <meta property="og:video:width" content="1280">
        <meta property="og:video:height" content="720">
        <meta property="og:image:width" content="300">
        <meta property="og:image:height" content="200">
        <meta property="og:video" content="http://test.com/video_two.mp4">
        <meta property="og:image" content="http://test.com/two.png">
        <meta property="og:image:height" content="100">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    expect(ogObject.ogImage).to.eql([{
      url: 'http://test.com/one.png',
      width: '300',
      height: '200',
    }, {
      url: 'http://test.com/two.png',
      height: '100',
    }]);

    expect(ogObject.ogVideo).to.eql([{
      url: 'http://test.com/video_one.mp4',
      width: '1280',
      height: '720',
    }, {
      url: 'http://test.com/video_two.mp4',
    }]);
  });

  it('limits the results to ten groups without shifting values', function () {
    const metaTags = Array.from({ length: 11 }, (unused, index) => `
        <meta property="og:image" content="http://test.com/logo${index + 1}.png">
        <meta property="og:image:height" content="${index + 1}">`).join('');
    const ogObject = extractMetaTags(
      `
      <html><head>${metaTags}
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    // the eleventh group is dropped and every kept group still has its own height
    expect(ogObject.ogImage).to.eql([
      { url: 'http://test.com/logo10.png', height: '10' },
      { url: 'http://test.com/logo9.png', height: '9' },
      { url: 'http://test.com/logo8.png', height: '8' },
      { url: 'http://test.com/logo7.png', height: '7' },
      { url: 'http://test.com/logo6.png', height: '6' },
      { url: 'http://test.com/logo5.png', height: '5' },
      { url: 'http://test.com/logo4.png', height: '4' },
      { url: 'http://test.com/logo3.png', height: '3' },
      { url: 'http://test.com/logo2.png', height: '2' },
      { url: 'http://test.com/logo1.png', height: '1' },
    ]);
  });

  it('ignores orphan sub properties that appear before any root tag', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image:width" content="999">
        <meta property="og:image:height" content="999">
        <meta property="og:image:type" content="image/png">
        <meta property="og:image" content="http://test.com/one.png">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    expect(ogObject.ogImage).to.eql([{
      url: 'http://test.com/one.png',
    }]);
  });

  it('outputs nothing when only orphan sub properties exist', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image:width" content="999">
        <meta property="og:image:secure_url" content="https://test.com/one.png">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    expect(ogObject.ogImage).to.eql(undefined);
  });

  it('uses the last value when a sub property repeats inside one group', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image:width" content="200">
        <meta property="og:image:alt" content="first alt">
        <meta property="og:image:alt" content="second alt">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    expect(ogObject.ogImage).to.eql([{
      url: 'http://test.com/one.png',
      width: '200',
      alt: 'second alt',
    }]);
  });

  it('treats an empty root tag as a group boundary but does not output it', function () {
    const ogObject = extractMetaTags(
      `
      <html><head>
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image" content="">
        <meta property="og:image:width" content="999">
        <meta property="og:image" content="http://test.com/two.png">
      </head></html>`,
      { onlyGetOpenGraphInfo: true },
    );

    // the width belongs to the empty group, so it is dropped together with it
    expect(ogObject.ogImage).to.eql([{
      url: 'http://test.com/one.png',
    }, {
      url: 'http://test.com/two.png',
    }]);
  });
});
