import * as path from 'path';

// Terse standalone logger.
// - Single-line output with colored prefixes
// - Captures raw console.* calls when `installConsoleCapture()` is run
// - Includes caller `file:line` for `warn` and `error` (and when an Error is passed)

const COLORS = {
  LOG: '\x1b[36m',    // cyan
  INFO: '\x1b[36m',   // cyan
  DEBUG: '\x1b[35m',  // magenta
  WARN: '\x1b[33m',   // yellow
  ERROR: '\x1b[31m',  // red
  RESET: '\x1b[0m',
};

function nowStamp() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

function safeStringify(v) {
    if (typeof v === 'string') return v.replace(/\s+/g, ' ');
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

function firstCallerLocation() {
    const orig = Error.prepareStackTrace;
    try {
        Error.prepareStackTrace = (_, stack) => stack;
        const err = new Error();
        const stack = err.stack;
        if (!stack || !Array.isArray(stack)) return undefined;
        for (const site of stack) {
            const file = site.getFileName && site.getFileName();
            if (!file) continue;
            // skip frames in this file
            if (file.endsWith('/packages/utils/src/logger.js') || file.includes('/node_modules/')) continue;
            const short = path.relative(process.cwd(), file) || file;
            const line = site.getLineNumber ? site.getLineNumber() : null;
            return line ? `${short}:${line}` : short;
        }
    } catch {
        // ignore
    } finally {
        Error.prepareStackTrace = orig;
    }
    return undefined;
}

const _console = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

function singleLine(...parts) {
    return parts
        .map(p => (p === undefined ? '' : safeStringify(p)))
        .join(' ')
        .replace(/\n+/g, ' ')
        .trim();
}

function make(kind, consoleFn, includeSource) {
    return (...args) => {
        // If first arg is an Error, extract its message and use caller location
        let src;
        if (includeSource) {
            src = firstCallerLocation();
        }
        const parts = args.map(a => {
            if (a instanceof Error) {
                // keep only the message (avoid multiline stacks); include short stack line if available
                const firstStackLine = (a.stack || '').split('\n')[1] || '';
                return `${a.message}${firstStackLine ? ' | ' + firstStackLine.trim() : ''}`;
            }
            return a;
        });
        const body = singleLine(...parts);
        const kindUpper = kind.toUpperCase();
        const color = COLORS[kindUpper] || COLORS.RESET;
        const prefix = `${color}[${nowStamp()}] ${kindUpper}${src ? ' ' + src : ''}${COLORS.RESET}`;
        consoleFn(prefix + ' ' + body);
    };
}

export const Logger = {
    log: make('log', _console.log, false),
    info: make('info', _console.info, false),
    debug: make('debug', _console.debug, false),
    warn: make('warn', _console.warn, true),
    error: make('error', _console.error, true),
};

export default Logger;

