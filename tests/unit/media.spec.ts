import { expect } from 'chai';

import { collectMediaTag, createMediaCollector } from '../../lib/mediaCollector';
import { mediaSetup } from '../../lib/media';

// helper: feed [fieldName, content] pairs through the collector and run mediaSetup
const runMediaSetup = (tags: Array<[Parameters<typeof collectMediaTag>[1], string]>) => {
  const collector = createMediaCollector();
  tags.forEach(([fieldName, content]) => collectMediaTag(collector, fieldName, content));
  return mediaSetup({ mediaCollector: collector });
};

describe('media', function () {
  it('has images and twitter images', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
      ['twitterImageProperty', 'http://test.com/logo.png'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageWidth', '300'],
      ['twitterImageHeight', '300'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }]);

    expect(ogMedia.twitterImage).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      alt: 'image/png',
    }]);
  });

  it('has twitter images but falls back to twitterImageSrc', function () {
    const ogMedia = runMediaSetup([
      ['twitterImageSrc', 'http://test.com/logoTwo.png'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageWidth', '300'],
      ['twitterImageHeight', '300'],
    ]);

    expect(ogMedia.twitterImage).to.eql([{
      url: 'http://test.com/logoTwo.png',
      width: '300',
      height: '300',
      alt: 'image/png',
    }]);
  });

  it('has image/twitterImage but no type/height/width', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['twitterImageProperty', 'http://test.com/logo.png'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo.png',
    }]);

    expect(ogMedia.twitterImage).to.eql([{
      url: 'http://test.com/logo.png',
    }]);
  });

  it('has images and twitter images without a root tag', function () {
    const ogMedia = runMediaSetup([
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageWidth', '300'],
      ['twitterImageHeight', '300'],
    ]);

    expect(ogMedia).to.eql({});
  });

  it('ignores an orphan secure_url before any root instead of replacing the whole group', function () {
    const ogMedia = runMediaSetup([
      ['ogImageSecureURL', 'https://test.com/secure-only.png'],
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
    ]);

    // the orphan secure_url (before any root) is ignored, logo.png keeps its http url and properties
    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }]);
  });

  it('secure_url only replaces the url of the image it belongs to', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['ogImageSecureURL', 'https://test.com/logo.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
      ['ogImageProperty', 'http://test.com/logoTwo.png'],
      ['ogImageType', 'image/jpeg'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'https://test.com/logo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }, {
      url: 'http://test.com/logoTwo.png',
      type: 'image/jpeg',
    }]);
  });

  it('has image with ogImageURL', function () {
    const ogMedia = runMediaSetup([
      ['ogImageURL', 'http://test.com/logoTwo.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logoTwo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }]);
  });

  it('does not attach one image dimensions to another image', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo_one.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
      ['ogImageProperty', 'http://test.com/logo_two.png'],
      ['ogImageType', 'image/png'],
      ['ogImageProperty', 'http://test.com/logo_three.png'],
      ['ogImageType', 'image/png'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo_one.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }, {
      url: 'http://test.com/logo_two.png',
      type: 'image/png',
    }, {
      url: 'http://test.com/logo_three.png',
      type: 'image/png',
    }]);
  });

  it('has many twitter images and does not share properties between them', function () {
    const ogMedia = runMediaSetup([
      ['twitterImageProperty', 'http://test.com/logo_one.png'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageWidth', '300'],
      ['twitterImageHeight', '300'],
      ['twitterImageProperty', 'http://test.com/logo_two.png'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageProperty', 'http://test.com/logo_three.png'],
      ['twitterImageAlt', 'image/png'],
    ]);

    expect(ogMedia.twitterImage).to.eql([{
      url: 'http://test.com/logo_one.png',
      width: '300',
      height: '300',
      alt: 'image/png',
    }, {
      url: 'http://test.com/logo_two.png',
      alt: 'image/png',
    }, {
      url: 'http://test.com/logo_three.png',
      alt: 'image/png',
    }]);
  });

  it('has a .gif images and twitter images', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo_one.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
      ['ogImageProperty', 'http://test.com/logo_two.gif'],
      ['ogImageType', 'image/gif'],
      ['ogImageWidth', '600'],
      ['ogImageHeight', '600'],
      ['twitterImageProperty', 'http://test.com/logo_two.gif'],
      ['twitterImageAlt', 'image/gif'],
      ['twitterImageWidth', '300'],
      ['twitterImageHeight', '300'],
      ['twitterImageProperty', 'http://test.com/logo_one.png'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageWidth', '600'],
      ['twitterImageHeight', '600'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo_two.gif',
      type: 'image/gif',
      width: '600',
      height: '600',
    }, {
      url: 'http://test.com/logo_one.png',
      type: 'image/png',
      width: '300',
      height: '300',
    }]);

    expect(ogMedia.twitterImage).to.eql([{
      url: 'http://test.com/logo_two.gif',
      alt: 'image/gif',
      width: '300',
      height: '300',
    }, {
      url: 'http://test.com/logo_one.png',
      alt: 'image/png',
      width: '600',
      height: '600',
    }]);
  });

  it('has no image or video', function () {
    const ogMedia = mediaSetup({
      ogTitle: 'test site',
      ogType: 'website',
      ogUrl: 'http://test.com/',
      ogDescription: 'stuff',
    });

    expect(ogMedia.ogImage).to.eql(undefined);
    expect(ogMedia.twitterImage).to.eql(undefined);
    expect(ogMedia.ogVideo).to.eql(undefined);
    expect(ogMedia.twitterPlayer).to.eql(undefined);
  });

  it('has video and twitter video', function () {
    const ogMedia = runMediaSetup([
      ['ogVideoProperty', 'http://test.com/logo.png'],
      ['ogVideoType', 'image/png'],
      ['ogVideoWidth', '300'],
      ['ogVideoHeight', '300'],
      ['twitterPlayerProperty', 'http://test.com/logo.png'],
      ['twitterPlayerStream', 'image/png'],
      ['twitterPlayerWidth', '300'],
      ['twitterPlayerHeight', '300'],
    ]);

    expect(ogMedia.ogVideo).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }]);

    expect(ogMedia.twitterPlayer).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      stream: 'image/png',
    }]);
  });

  it('has video/twitterVideo but no type/width/height', function () {
    const ogMedia = runMediaSetup([
      ['ogVideoProperty', 'http://test.com/logo.png'],
      ['twitterPlayerProperty', 'http://test.com/logo.png'],
    ]);

    expect(ogMedia.ogVideo).to.eql([{
      url: 'http://test.com/logo.png',
    }]);

    expect(ogMedia.twitterPlayer).to.eql([{
      url: 'http://test.com/logo.png',
    }]);
  });

  it('has video and twitter video but with no root tag', function () {
    const ogMedia = runMediaSetup([
      ['ogVideoType', 'image/png'],
      ['ogVideoWidth', '300'],
      ['ogVideoHeight', '300'],
      ['twitterPlayerStream', 'image/png'],
      ['twitterPlayerWidth', '300'],
      ['twitterPlayerHeight', '300'],
    ]);

    expect(ogMedia).to.eql({});
  });

  it('has music:song', function () {
    const ogMedia = runMediaSetup([
      ['musicSongProperty', 'http://test.com/songurl'],
      ['musicSongTrack', '1'],
      ['musicSongDisc', '1'],
    ]);

    expect(ogMedia.musicSong).to.eql([{
      url: 'http://test.com/songurl',
      track: '1',
      disc: '1',
    }]);
  });

  it('has music:song but falls back to musicSongUrl', function () {
    const ogMedia = runMediaSetup([
      ['musicSongUrl', 'http://test.com/songurlTwo'],
      ['musicSongTrack', '1'],
      ['musicSongDisc', '1'],
    ]);

    expect(ogMedia.musicSong).to.eql([{
      url: 'http://test.com/songurlTwo',
      track: '1',
      disc: '1',
    }]);
  });

  it('has music:song but no track/disc', function () {
    const ogMedia = runMediaSetup([
      ['musicSongProperty', 'http://test.com/songurl'],
    ]);

    expect(ogMedia.musicSong).to.eql([{
      url: 'http://test.com/songurl',
    }]);
  });

  it('has multiple music:songs without sharing track/disc between them', function () {
    const ogMedia = runMediaSetup([
      ['musicSongProperty', 'http://test.com/songurl'],
      ['musicSongTrack', '1'],
      ['musicSongDisc', '1'],
      ['musicSongProperty', 'http://test.com/songurl3'],
      ['musicSongTrack', '2'],
      ['musicSongDisc', '2'],
      ['musicSongProperty', 'http://test.com/songurl2'],
      ['musicSongTrack', '4'],
      ['musicSongDisc', '1'],
    ]);

    expect(ogMedia.musicSong).to.eql([{
      url: 'http://test.com/songurl',
      track: '1',
      disc: '1',
    },
    {
      url: 'http://test.com/songurl2',
      track: '4',
      disc: '1',
    },
    {
      url: 'http://test.com/songurl3',
      track: '2',
      disc: '2',
    }]);
  });

  it('has all five media classes at once', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['ogImageType', 'image/png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
      ['twitterImageProperty', 'http://test.com/logo.png'],
      ['twitterImageAlt', 'image/png'],
      ['twitterImageWidth', '300'],
      ['twitterImageHeight', '300'],
      ['ogVideoProperty', 'http://test.com/logo.png'],
      ['ogVideoType', 'image/png'],
      ['ogVideoWidth', '300'],
      ['ogVideoHeight', '300'],
      ['twitterPlayerProperty', 'http://test.com/logo.png'],
      ['twitterPlayerStream', 'image/png'],
      ['twitterPlayerWidth', '300'],
      ['twitterPlayerHeight', '300'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }]);

    expect(ogMedia.twitterImage).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      alt: 'image/png',
    }]);

    expect(ogMedia.ogVideo).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      type: 'image/png',
    }]);

    expect(ogMedia.twitterPlayer).to.eql([{
      url: 'http://test.com/logo.png',
      width: '300',
      height: '300',
      stream: 'image/png',
    }]);
  });

  it('an empty root tag still cuts off the previous object', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo_one.png'],
      ['ogImageWidth', '100'],
      ['ogImageHeight', '100'],
      ['ogImageProperty', ''],
      ['ogImageWidth', '200'],
      ['ogImageHeight', '200'],
      ['ogImageProperty', 'http://test.com/logo_three.png'],
      ['ogImageWidth', '300'],
      ['ogImageHeight', '300'],
    ]);

    // the empty root is dropped as an invalid object, but its width/height
    // stay attached to the empty object instead of leaking onto logo_three
    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo_three.png',
      width: '300',
      height: '300',
    }, {
      url: 'http://test.com/logo_one.png',
      width: '100',
      height: '100',
    }]);
  });

  it('keeps separate objects even when their urls are identical', function () {
    const ogMedia = runMediaSetup([
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['ogImageWidth', '100'],
      ['ogImageHeight', '100'],
      ['ogImageProperty', 'http://test.com/logo.png'],
      ['ogImageWidth', '200'],
      ['ogImageHeight', '200'],
    ]);

    expect(ogMedia.ogImage).to.eql([{
      url: 'http://test.com/logo.png',
      width: '200',
      height: '200',
    }, {
      url: 'http://test.com/logo.png',
      width: '100',
      height: '100',
    }]);
  });

  it('has more then 10 images', function () {
    const tags: Array<[Parameters<typeof collectMediaTag>[1], string]> = [];
    for (let i = 1; i <= 11; i += 1) {
      tags.push(['ogImageProperty', `http://test.com/logo${i}.png`]);
      tags.push(['ogImageType', 'image/png']);
      tags.push(['ogImageWidth', '300']);
      tags.push(['ogImageHeight', '300']);
    }

    const ogMedia = runMediaSetup(tags);

    expect(ogMedia.ogImage?.length).to.eql(10);
    expect(ogMedia.ogImage).to.eql([
      {
        url: 'http://test.com/logo1.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo2.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo3.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo4.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo5.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo6.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo7.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo8.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo9.png', width: '300', height: '300', type: 'image/png',
      },
      {
        url: 'http://test.com/logo10.png', width: '300', height: '300', type: 'image/png',
      },
    ]);
  });
});
