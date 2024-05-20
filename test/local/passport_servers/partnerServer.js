import { createServer } from 'http';
import { Cookie } from 'tough-cookie';
import { assert } from 'chai';
import { AuthHeader } from '../../../lib/AuthHeader.js';
import { config } from './config.js';
import { getContent } from './users.js';

// eslint-disable-next-line consistent-return
export const partnerServer = createServer((req, res) => {
    if (req.headers.cookie) {
        const cookieHeaders = Array.isArray(req.headers.cookie) ? req.headers.cookie : [req.headers.cookie];
        const cookies = cookieHeaders.map(cookieHeader => Cookie.parse(cookieHeader));
        const authCookie = cookies.filter(cookie => cookie.key === 'auth')[0];

        if (authCookie && authCookie.value === req.url) {
            return res.end(getContent(req.url));
        }
    }

    const authorizationHeader = new AuthHeader(req.headers.authorization);

    assert.strictEqual(authorizationHeader.isBasic, false,
        'Proxy sent a Basic authorization header to the partner server');

    if (authorizationHeader.isPassport14 && authorizationHeader.parameters['from-PP']) {
        res.setHeader('Set-Cookie', 'auth=' + authorizationHeader.parameters['from-PP']);
        return res.end();
    }

    res.setHeader('Location', 'https://login.localhost/');
    res.setHeader('WWW-Authenticate',
        `Passport1.4 resource=${req.url},ru=${config.PARTNER_SERVER_URL}`);
    res.writeHead(302);
    res.end();
});
