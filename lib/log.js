import debug from 'debug';

if (!process.env.DEBUG) {
    debug.enable('proxy:info,proxy:error');
}

// info (-> STDOUT)
export const log = debug('proxy:info');
log.log = console.log.bind(console); // eslint-disable-line no-console

// error (-> STDERR)
log.e = debug('proxy:error');

// debug (-> STDOUT)
log.d = debug('proxy:debug');
log.d.log = console.log.bind(console); // eslint-disable-line no-console

// trace (-> STDOUT)
log.t = debug('proxy:trace');
log.t.log = console.log.bind(console); // eslint-disable-line no-console
log.t.enabled = debug.enabled('proxy:trace');

