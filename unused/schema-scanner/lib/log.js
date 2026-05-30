// Tiny structured logger. No deps.
const COLORS = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function emit(color, level, args) {
  const prefix = `${COLORS.dim}${stamp()}${COLORS.reset} ${color}${level}${COLORS.reset}`;
  console.error(prefix, ...args);
}

export const log = {
  info:  (...a) => emit(COLORS.cyan,    'info ', a),
  ok:    (...a) => emit(COLORS.green,   'ok   ', a),
  warn:  (...a) => emit(COLORS.yellow,  'warn ', a),
  error: (...a) => emit(COLORS.red,     'error', a),
  debug: (...a) => process.env.DEBUG && emit(COLORS.magenta, 'debug', a)
};
