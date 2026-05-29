import assert from 'assert';
import Logger from '../src/logger.js';

function captureStdout(fn) {
  const out = [];
  const orig = process.stdout.write;
  process.stdout.write = (chunk, encoding, cb) => {
    out.push(String(chunk));
    if (typeof cb === 'function') cb();
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = orig;
  }
  return out.join('');
}

function captureStderr(fn) {
  const out = [];
  const orig = process.stderr.write;
  process.stderr.write = (chunk, encoding, cb) => {
    out.push(String(chunk));
    if (typeof cb === 'function') cb();
    return true;
  };
  try {
    fn();
  } finally {
    process.stderr.write = orig;
  }
  return out.join('');
}

function singleNonEmptyLine(s) {
  return s.split('\n').map(l => l.trim()).filter(Boolean);
}

// 1) Basic log: multiple args and object formatting
const out1 = captureStdout(() => Logger.log('hello', { a: 1 }, 42));
console.log('Captured LOG =>', out1.trim());
assert(out1.includes('LOG'), 'Logger.log should include LOG');
assert(out1.includes('hello'), 'Logger.log should include message');
assert(out1.includes('"a":1') || out1.includes('a:1'), 'Logger.log should include JSON of object');
assert(out1.includes('42'), 'Logger.log should include numeric arg');
assert(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/.test(out1), 'Logger.log should include timestamp');
assert(singleNonEmptyLine(out1).length === 1, 'Logger.log output should be a single line');

// 2) info/debug behave like log but include level
const outInfo = captureStdout(() => Logger.info('info!', { ok: true }));
console.log('Captured INFO =>', outInfo.trim());
assert(outInfo.includes('INFO'), 'Logger.info should include INFO');

const outDebug = captureStdout(() => Logger.debug('dbg', [1,2,3]));
console.log('Captured DEBUG =>', outDebug.trim());
assert(outDebug.includes('DEBUG'), 'Logger.debug should include DEBUG');

// 3) warn includes caller file:line and goes to stderr
const outWarn = captureStderr(() => Logger.warn('watch out', { x: 2 }));
console.log('Captured WARN =>', outWarn.trim());
assert(outWarn.includes('WARN'), 'Logger.warn should include WARN');
const callerRefPattern = /packages\/utils\/test\/test\.js:\d+/;
assert(callerRefPattern.test(outWarn) || outWarn.includes('test/test.js:'), 'Logger.warn should include caller file:line reference (test/test.js)');
assert(singleNonEmptyLine(outWarn).length === 1, 'Logger.warn output should be a single line');

// 4) error with Error object prints error message concisely
const outErr = captureStderr(() => Logger.error(new Error('boom'), 'extra'));
console.log('Captured ERROR =>', outErr.trim());
assert(outErr.includes('ERROR'), 'Logger.error should include ERROR');
assert(outErr.includes('boom'), 'Logger.error should include error message');
// ensure no multiline stack traces are emitted in the basic logger
assert(singleNonEmptyLine(outErr).length === 1, 'Logger.error should be a single concise line (no multiline stack)');

console.log('All logger tests passed');
