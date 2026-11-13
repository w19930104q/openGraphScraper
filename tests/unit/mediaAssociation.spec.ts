import { expect } from 'chai';
import sinon from 'sinon';

import undici = require('undici');
import {
  getGlobalDispatcher, MockAgent, setGlobalDispatcher,
} from 'undici';
import ogs from '../../index';

const sandbox = sinon.createSandbox();
const mockAgent = new MockAgent();
const originalFetch = undici.fetch;
const originalGlobalDispatcher = getGlobalDispatcher();

const wrapHTML = (metaTags: string) => `
  <html>
    <head>
      <meta charset="utf-8">
      ${metaTags}
    </head>
    <body></body>
  </html>`;

describe('media association', function () {
  beforeEach(function () {
    setGlobalDispatcher(mockAgent);
    mockAgent.disableNetConnect();
    sandbox.stub(undici, 'fetch').callsFake((input, init) => originalFetch(input, { ...init, dispatcher: mockAgent }));
  });

  afterEach(function () {
    sandbox.restore();
    mockAgent.enableNetConnect();
    setGlobalDispatcher(originalGlobalDispatcher);
  });

  context('using the html option', function () {
    it('keeps sparse child properties on the media item they belong to', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image" content="http://test.com/two.png">
        <meta property="og:image:width" content="300">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/two.png',
          width: '300',
          type: 'png',
        }, {
          url: 'http://test.com/one.png',
          type: 'png',
        }]);
      });
    });

    it('only replaces the url of the image a secure_url belongs to', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image:secure_url" content="https://test.com/one-secure.png">
        <meta property="og:image" content="http://test.com/two.png">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'https://test.com/one-secure.png',
          type: 'png',
        }, {
          url: 'http://test.com/two.png',
          type: 'png',
        }]);
      });
    });

    it('keeps child properties within their own family when families interleave', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:video" content="http://test.com/video.mp4">
        <meta property="og:image:width" content="640">
        <meta property="og:video:height" content="360">
        <meta property="music:song" content="http://test.com/song">
        <meta property="music:song:track" content="2">
        <meta property="og:image:height" content="480">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/one.png',
          width: '640',
          height: '480',
          type: 'png',
        }]);
        expect(data.result.ogVideo).to.be.eql([{
          url: 'http://test.com/video.mp4',
          height: '360',
        }]);
        expect(data.result.musicSong).to.be.eql([{
          url: 'http://test.com/song',
          track: '2',
        }]);
      });
    });

    it('treats og:image/og:image:url roots as separate items in order of appearance', function () {
      const html = wrapHTML(`
        <meta property="og:image:url" content="http://test.com/one.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image" content="http://test.com/two.png">
        <meta property="og:image:height" content="200">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/two.png',
          height: '200',
          type: 'png',
        }, {
          url: 'http://test.com/one.png',
          width: '100',
          type: 'png',
        }]);
      });
    });

    it('treats og:video:url as a root alias of og:video', function () {
      const html = wrapHTML(`
        <meta property="og:video:url" content="http://test.com/video.mp4">
        <meta property="og:video:type" content="video/mp4">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogVideo).to.be.eql([{
          url: 'http://test.com/video.mp4',
          type: 'video/mp4',
        }]);
      });
    });

    it('treats music:song:url as a root alias of music:song', function () {
      const html = wrapHTML(`
        <meta property="music:song" content="http://test.com/song1">
        <meta property="music:song:track" content="1">
        <meta property="music:song:url" content="http://test.com/song2">
        <meta property="music:song:track" content="2">
        <meta property="music:song:disc" content="1">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.musicSong).to.be.eql([{
          url: 'http://test.com/song1',
          track: '1',
        }, {
          url: 'http://test.com/song2',
          track: '2',
          disc: '1',
        }]);
      });
    });

    it('severs the previous item when an empty root is found', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image" content="">
        <meta property="og:image:width" content="300">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/one.png',
          type: 'png',
        }]);
      });
    });

    it('ignores orphan child properties that appear before any root', function () {
      const html = wrapHTML(`
        <meta property="og:image:width" content="300">
        <meta property="og:image" content="http://test.com/one.png">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/one.png',
          type: 'png',
        }]);
      });
    });

    it('ignores child properties when there is no root at all', function () {
      const html = wrapHTML(`
        <meta property="og:image:secure_url" content="https://test.com/one.png">
        <meta property="og:image:width" content="300">
        <meta property="og:video:width" content="640">
        <meta property="music:song:track" content="1">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql(undefined);
        expect(data.result.ogVideo).to.be.eql(undefined);
        expect(data.result.musicSong).to.be.eql(undefined);
      });
    });

    it('keeps the first value when a child property repeats within one item', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image:width" content="200">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/one.png',
          width: '100',
          type: 'png',
        }]);
      });
    });

    it('does not merge items that share the same url', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/dup.png">
        <meta property="og:image" content="http://test.com/dup.png">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/dup.png',
          type: 'png',
        }, {
          url: 'http://test.com/dup.png',
          type: 'png',
        }]);
      });
    });

    it('still limits the results to 10 items', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/1.png">
        <meta property="og:image" content="http://test.com/2.png">
        <meta property="og:image" content="http://test.com/3.png">
        <meta property="og:image" content="http://test.com/4.png">
        <meta property="og:image" content="http://test.com/5.png">
        <meta property="og:image" content="http://test.com/6.png">
        <meta property="og:image" content="http://test.com/7.png">
        <meta property="og:image" content="http://test.com/8.png">
        <meta property="og:image" content="http://test.com/9.png">
        <meta property="og:image" content="http://test.com/10.png">
        <meta property="og:image" content="http://test.com/11.png">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.have.length(10);
        expect(data.result.ogImage?.[9]).to.be.eql({
          url: 'http://test.com/10.png',
          type: 'png',
        });
      });
    });

    it('keeps the twitter image semantics unchanged', function () {
      const html = wrapHTML(`
        <meta name="twitter:image" content="http://test.com/tw.png">
        <meta name="twitter:image:width" content="300">
        <meta name="twitter:player" content="http://test.com/player">
        <meta name="twitter:player:height" content="360">
      `);

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.twitterImage).to.be.eql([{
          url: 'http://test.com/tw.png',
          width: '300',
        }]);
        expect(data.result.twitterPlayer).to.be.eql([{
          url: 'http://test.com/player',
          height: '360',
        }]);
      });
    });

    it('still falls back to img elements when there is no og:image', function () {
      const html = `
        <html>
          <head><meta charset="utf-8"></head>
          <body><img src="http://test.com/fallback.png" width="360"></body>
        </html>`;

      return ogs({ html }).then(function (data) {
        expect(data.result.success).to.be.eql(true);
        expect(data.result.ogImage).to.be.eql([{
          url: 'http://test.com/fallback.png',
          width: 360,
          type: 'png',
        }]);
      });
    });
  });

  context('using the url option', function () {
    it('returns the same media items as the html option', function () {
      const html = wrapHTML(`
        <meta property="og:image" content="http://test.com/one.png">
        <meta property="og:image" content="http://test.com/two.png">
        <meta property="og:image:width" content="300">
        <meta property="og:image:secure_url" content="https://test.com/two-secure.png">
        <meta property="og:video" content="http://test.com/video.mp4">
        <meta property="music:song:url" content="http://test.com/song">
        <meta property="music:song:track" content="3">
      `);

      // a public IP literal keeps the request offline since no DNS lookup is needed
      mockAgent.get('http://93.184.216.34')
        .intercept({ path: '/' })
        .reply(200, html);

      return Promise.all([ogs({ html }), ogs({ url: 'http://93.184.216.34' })])
        .then(function ([fromHTML, fromURL]) {
          expect(fromHTML.result.success).to.be.eql(true);
          expect(fromURL.result.success).to.be.eql(true);
          expect(fromURL.result.ogImage).to.be.eql(fromHTML.result.ogImage);
          expect(fromURL.result.ogVideo).to.be.eql(fromHTML.result.ogVideo);
          expect(fromURL.result.musicSong).to.be.eql(fromHTML.result.musicSong);
          expect(fromURL.result.ogImage).to.be.eql([{
            url: 'https://test.com/two-secure.png',
            width: '300',
            type: 'png',
          }, {
            url: 'http://test.com/one.png',
            type: 'png',
          }]);
          expect(fromURL.result.ogVideo).to.be.eql([{
            url: 'http://test.com/video.mp4',
          }]);
          expect(fromURL.result.musicSong).to.be.eql([{
            url: 'http://test.com/song',
            track: '3',
          }]);
        });
    });
  });
});
