// Shared by the browser and the reward verifier. No client-supplied score is trusted.
export const VERSION = 1;
export const BPM = 108;
export const BEAT = 60_000 / BPM;
export const DURATION = 102 * BEAT;
export const APPROACH = 1800;
export const WINDOW = 145;
export const TIERS = Object.freeze([
  { score: 9200, id: 'discount-20', label: '20% 할인' },
  { score: 8000, id: 'discount-15', label: '15% 할인' },
  { score: 6500, id: 'discount-10', label: '10% 할인' },
  { score: 5000, id: 'shipping-free', label: '무료배송' },
]);
const ITEMS = [['book', 'laptop', 'headphones'], ['bottle', 'camera', 'glasses'], ['passport', 'camera', 'headphones']];

export function chart(seed = 0) {
  const notes = [];
  for (let bar = 0; bar < 24; bar++) {
    const scene = Math.floor(bar / 8);
    const hold = bar % 4 === 3;
    const pattern = hold ? [0, 1, 2] : bar < 8 ? [0, 1, 2, 3] : bar % 2 ? [0, 1.5, 2.5, 3] : [0, 1, 2, 2.5, 3];
    for (const [index, beat] of pattern.entries()) {
      const isHold = hold && index === 2;
      notes.push({ id: notes.length, at: (4 + bar * 4 + beat) * BEAT, duration: isHold ? 1.5 * BEAT : 0,
        item: isHold ? 'zip' : ITEMS[scene][(bar + index + (seed >>> 0)) % 3], scene });
    }
  }
  return notes;
}
export function judgement(delta) {
  const distance = Math.abs(delta);
  return distance <= 65 ? 'perfect' : distance <= WINDOW ? 'good' : 'miss';
}
export class Round {
  constructor(seed) {
    this.notes = chart(seed).map(note => ({ ...note, head: null, tail: null }));
    this.units = this.notes.reduce((sum, note) => sum + (note.duration ? 2 : 1), 0);
    this.counts = { perfect: 0, good: 0, miss: 0 };
    this.points = 0; this.combo = 0; this.maxCombo = 0; this.down = false; this.holding = null;
    this.feedback = []; this.lastTime = 0;
  }
  award(note, part, grade, delta = 0) {
    if (note[part] !== null) return;
    note[part] = grade; this.counts[grade]++;
    this.points += grade === 'perfect' ? 100 : grade === 'good' ? 70 : 0;
    this.combo = grade === 'miss' ? 0 : this.combo + 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.feedback.push({ id: note.id, part, grade, delta, item: note.item });
  }
  advance(time) {
    this.lastTime = Math.max(this.lastTime, time);
    for (const note of this.notes) {
      if (note.head === null && time > note.at + WINDOW) {
        this.award(note, 'head', 'miss');
        if (note.duration) this.award(note, 'tail', 'miss');
      }
      if (note.duration && note.head !== null && note.tail === null && time > note.at + note.duration + WINDOW) {
        this.award(note, 'tail', 'miss');
        if (this.holding === note) this.holding = null;
      }
    }
  }
  press(time) {
    this.advance(time);
    if (this.down) return false;
    this.down = true;
    const note = this.notes.find(n => n.head === null && Math.abs(n.at - time) <= WINDOW);
    if (note) { this.award(note, 'head', judgement(time - note.at), time - note.at); if (note.duration) this.holding = note; }
    return true;
  }
  release(time) {
    this.advance(time);
    if (!this.down) return false;
    this.down = false;
    if (this.holding) {
      const note = this.holding;
      this.award(note, 'tail', judgement(time - note.at - note.duration), time - note.at - note.duration);
      this.holding = null;
    }
    return true;
  }
  get score() { return Math.round(this.points / (this.units * 100) * 10_000); }
  result() { return { score: this.score, maxCombo: this.maxCombo, ...this.counts, units: this.units }; }
}
export function scoreRound(seed, events, offset = 0) {
  if (!Array.isArray(events) || events.length > 768 || !Number.isInteger(offset) || Math.abs(offset) > 150) throw new Error('invalid-input');
  const round = new Round(seed);
  let previous = -1;
  for (const event of events) {
    if (!event || !['down', 'up'].includes(event.type) || !Number.isFinite(event.at) || event.at < 0 || event.at > DURATION || event.at < previous) throw new Error('invalid-input');
    previous = event.at;
    const accepted = event.type === 'down' ? round.press(event.at + offset) : round.release(event.at + offset);
    if (!accepted) throw new Error('invalid-sequence');
  }
  round.advance(DURATION + WINDOW + 1);
  return round.result();
}
export function eligibleTiers(score) { return TIERS.filter(tier => score >= tier.score).map(tier => tier.id); }
