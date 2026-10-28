import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeAmbientFilm } from '../assets/ambient-film.js';

class Signal extends EventTarget {
  constructor(matches = false) { super(); this.matches = matches; }
  set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')); }
}
class Control extends EventTarget {
  attrs = {};
  setAttribute(name, value) { this.attrs[name] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}
function fixture({ reduced = false, small = true } = {}) {
  const source = { dataset: { src: '/desktop.mp4' }, src: '' };
  const toggle = new Control();
  const sound = new Control();
  const video = Object.assign(new EventTarget(), {
    dataset: { ambientMobileSrc: '/mobile.mp4' }, paused: true, muted: true, loads: 0,
    querySelector: () => source,
    load() { this.loads++; },
    play() { this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); },
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); },
  });
  const film = { querySelector: selector => ({ '[data-ambient-video]': video, '[data-ambient-toggle]': toggle, '[data-ambient-sound]': sound })[selector] };
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const motion = new Signal(reduced);
  let observer;
  class Observer {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {}
    disconnect() {}
    enter(isIntersecting) { this.callback([{ isIntersecting }]); }
  }
  const dispose = initializeAmbientFilm(film, { motion, mobile: new Signal(small), visibility, Observer });
  return { video, source, toggle, sound, motion, visibility, observer, dispose };
}

test('offscreen film does not load; visible film chooses mobile source and pauses on exit', () => {
  const f = fixture();
  assert.equal(f.video.loads, 0);
  assert.equal(f.source.src, '');
  f.observer.enter(true);
  assert.equal(f.source.src, '/mobile.mp4');
  assert.equal(f.video.loads, 1);
  assert.equal(f.video.paused, false);
  f.observer.enter(false);
  assert.equal(f.video.paused, true);
  f.observer.enter(true);
  assert.equal(f.video.loads, 1);
});

test('desktop source and hidden-tab lifecycle preserve manual pause intent', () => {
  const f = fixture({ small: false });
  f.observer.enter(true);
  assert.equal(f.source.src, '/desktop.mp4');
  f.visibility.hidden = true;
  f.visibility.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.video.paused, true);
  f.visibility.hidden = false;
  f.visibility.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.video.paused, false);
  f.toggle.click();
  f.observer.enter(false);
  f.observer.enter(true);
  assert.equal(f.video.paused, true);
  assert.equal(f.toggle.attrs['aria-pressed'], 'false');
});

test('reduced motion leaves the poster unloaded and permits explicit play', () => {
  const f = fixture({ reduced: true });
  f.observer.enter(true);
  assert.equal(f.video.loads, 0);
  assert.equal(f.video.paused, true);
  f.toggle.click();
  assert.equal(f.video.loads, 1);
  assert.equal(f.video.paused, false);
  f.motion.set(true);
  assert.equal(f.video.paused, true);
});

test('an autoplay rejection falls back to muted playback and sound control remains usable', async () => {
  const f = fixture();
  f.video.muted = false;
  const play = f.video.play;
  f.video.play = function () {
    if (!this.muted) return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
    return play.call(this);
  };
  f.observer.enter(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.video.muted, true);
  assert.equal(f.video.paused, false);
  assert.equal(f.sound.attrs['aria-pressed'], 'false');
});

test('a delayed play cannot keep running after viewport exit', async () => {
  const f = fixture();
  let finish;
  f.video.play = () => new Promise(resolve => { finish = () => { f.video.paused = false; resolve(); }; });
  f.observer.enter(true);
  f.observer.enter(false);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.video.paused, true);
});
