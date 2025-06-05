import { createServer } from 'http';
import { assert } from 'chai';
import { AuthHeader } from '../../../lib/AuthHeader.js';
import { parsePassportParameters } from '../../../lib/parsePassportParameters.js';
import { getUserdata } from './users.js';
import { config } from './config.js';

export const receivedCookieHeaders = [];
export function clearReceivedCookieHeaders() {
    receivedCookieHeaders.length = 0;
}

let redirectFlag = false;
export function resetRedirectFlag() {
    redirectFlag = false;
}

function send401(res) {
    res.setHeader('WWW-Authenticate', 'Passport1.4 da-status=failed,srealm=PassportTest,ctoken=abc');
    res.writeHead(401);
    res.end();
}

// eslint-disable-next-line consistent-return
export const authenticationServer = createServer((req, res) => {
    res.setHeader('PassportConfig', 'ConfigVersion=1');

    receivedCookieHeaders.push(req.headers.cookie || null);

    const authorizationHeader = new AuthHeader(req.headers.authorization);

    assert.strictEqual(authorizationHeader.isPassport14, true,
        'Authorization HTTP header is not Passport 1.4 header.');

    const {
        tname,
        'sign-in': usernameEnc,
        pwd: passwordEnc,
        'elapsed-time': elapsedTime,
        OrgVerb: orgVerb,
        OrgUrl: orgUrl,
        ctoken,
    } = authorizationHeader.parameters;

    if (!usernameEnc) {
        // Token Request Message
        assert.isString(tname, 'tname parameter is missing in Token Request Message');
        assert.isNotEmpty(orgVerb, 'OrgVerb parameter is missing in Token Request Message');
        assert.isNotEmpty(orgUrl, 'OrgUrl parameter is missing in Token Request Message');
        return send401(res);
    }

    const partnerServerChallenge = authorizationHeader.param.split(',ctoken=abc,')[1];

    assert.isNotEmpty(passwordEnc, 'pwd parameter is missing in Sign-in Request Message');
    assert.isNotEmpty(elapsedTime, 'elapsed-time parameter is missing in Sign-in Request Message');
    assert.isNotEmpty(orgVerb, 'OrgVerb parameter is missing in Sign-in Request Message');
    assert.isNotEmpty(orgUrl, 'OrgUrl parameter is missing in Sign-in Request Message');
    assert.isNotEmpty(ctoken, 'customtoken parameter is missing in Sign-in Request Message');
    assert.isNotEmpty(partnerServerChallenge, 'Partner Server Challenge is missing in Sign-in Request Message');

    const username = decodeURIComponent(usernameEnc);
    const password = decodeURIComponent(passwordEnc);
    const userdata = getUserdata(username);

    if (!userdata || userdata.password !== password) {
        return send401(res);
    }

    const challengeParameters = parsePassportParameters(partnerServerChallenge);

    if (userdata.directory !== challengeParameters['resource']) {
        return send401(res);
    }

    if (userdata.redirect && !redirectFlag) {
        redirectFlag = true;
        res.setHeader('Authentication-Info', 'Passport1.4 da-status=redir');
        res.setHeader('Location', `${config.AUTHENTICATION_SERVER_URL}redirect`);
        res.writeHead(302);
        return res.end();
    }

    res.setHeader('Authentication-Info', 'Passport1.4 da-status=success'
        + `,from-PP=${userdata.directory},ru=${challengeParameters['ru']}`);
    res.end();
});
