import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { createInterface } from 'readline';
import axios from 'axios';
import { assert } from 'chai';
import {AuthHeader} from '../../lib/AuthHeader.js';
import {partnerServer} from './passport_servers/partnerServer.js';
import {configurationServer} from './passport_servers/configurationServer.js';
import {
    authenticationServer,
    receivedCookieHeaders,
    clearReceivedCookieHeaders,
} from './passport_servers/authenticationServer.js';
import {config} from './passport_servers/config.js';
import {userlist} from './passport_servers/users.js';

// Create __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = axios.create({
    baseURL: 'http://localhost:3000/', // proxy url
    maxRedirects: 0,
    validateStatus: status => status < 500,
});

describe('local tests with mock servers', () => {
    before('Start partner server', (done) => {
        partnerServer.once('listening', () => {
            // console.log('Partner server listening:', partnerServer.address());
            done();
        });
        partnerServer.listen(config.PARTNER_SERVER_PORT);
    });

    before('Start configuration server', (done) => {
        configurationServer.once('listening', () => {
            // console.log('Configuration server listening:', configurationServer.address());
            done();
        });
        configurationServer.listen(config.CONFIGURATION_SERVER_PORT);
    });

    before('Start authentication server', (done) => {
        authenticationServer.once('listening', () => {
             // console.log('Authentication server listening:', authenticationServer.address());
            done();
        });
        authenticationServer.listen(config.AUTHENTICATION_SERVER_PORT);
    });

    let proxyServerChild;
    beforeEach('Start proxy server', (done) => {
        clearReceivedCookieHeaders();

        const env = { ...process.env };
        env.CONFIGURATION_SERVER_URL = config.CONFIGURATION_SERVER_URL;
        env.PROXY_TARGET = config.PARTNER_SERVER_URL;

        const proxyModule = path.resolve(__dirname, '../../lib/main.js');

        proxyServerChild = fork(proxyModule, { env, silent: true });

        const linereader = createInterface({ input: proxyServerChild.stdout });
        linereader.on('line', (line) => {
            const [, listeningMessage] = line.match(/(Proxy server listening:.*})/) || [];
            if (listeningMessage) {
                  // console.log(listeningMessage);
                done();
            }
        });
    });

    afterEach('Stop proxy server', (done) => {
        proxyServerChild.once('close', done);
        proxyServerChild.kill();
    });

    it('should request Basic authentication when not supplying credentials', async () => {
        const res = await client.get('/');
        assert.strictEqual(res.status, 401, 'HTTP status code is not 401');
        assert.property(res.headers, 'www-authenticate', 'WWW-Authenticate header missing');
        const authHeader = new AuthHeader(res.headers['www-authenticate']);
        assert.isOk(authHeader.isBasic, 'WWW-Authenticate scheme is not Basic');
    });

    it('should request Basic authentication when supplying wrong credentials', async () => {
        const res = await client.get('/', { auth: { username: 'abc@localhost', password: '123' } });
        assert.strictEqual(res.status, 401, 'HTTP status code is not 401');
        assert.property(res.headers, 'www-authenticate', 'WWW-Authenticate header missing');
        const authHeader = new AuthHeader(res.headers['www-authenticate']);
        assert.isOk(authHeader.isBasic, 'WWW-Authenticate scheme is not Basic');
    });

    it('should successfully do the Passport authentication process', async () => {
        const { username, password, directory, content } = userlist[0];
        const res = await client.get(directory, { auth: { username, password } });
        assert.strictEqual(res.status, 200, 'HTTP status code is not 200');
        assert.strictEqual(res.data, content, 'Did not receive the expected content');
    });

    it('should successfully handle subsequent requests', async () => {
        const { username, password, directory, content } = userlist[0];
        let res = await client.get(directory, { auth: { username, password } });
        assert.strictEqual(res.status, 200, 'HTTP status code is not 200');
        assert.strictEqual(res.data, content, 'Did not receive the expected content');
        res = await client.get(directory, { auth: { username, password } });
        assert.strictEqual(res.status, 200, 'HTTP status code is not 200');
        assert.strictEqual(res.data, content, 'Did not receive the expected content');
    });

    it('should not allow user A to access content of user B', async () => {
        const {
            username: usernameA,
            password: passwordA,
            directory: directoryA,
            content: contentA,
        } = userlist[0];

        const {
            username: usernameB,
            password: passwordB,
            directory: directoryB,
            content: contentB,
        } = userlist[1];

        let res = await client.get(directoryA, { auth: { username: usernameA, password: passwordA } });
        assert.strictEqual(res.status, 200, 'HTTP status code is not 200');
        assert.strictEqual(res.data, contentA, 'Did not receive the expected content');

        res = await client.get(directoryB, { auth: { username: usernameB, password: passwordB } });
        assert.strictEqual(res.status, 200, 'HTTP status code is not 200');
        assert.strictEqual(res.data, contentB, 'Did not receive the expected content');

        res = await client.get(directoryB, { auth: { username: usernameA, password: passwordA } });
        assert.strictEqual(res.status, 401, 'HTTP status code is not 401');
        assert.isNull(res.data, 'Response has content, but no content was expected');

        const lastCookie = receivedCookieHeaders[receivedCookieHeaders.length - 2];
        assert.strictEqual(lastCookie, 'auth=' + directoryA, 'Authentication server did not receive cookie header');
    });

    after('Stop authentication server', (done) => {
        authenticationServer.once('close', done);
        authenticationServer.close();
    });

    after('Stop configuration server', (done) => {
        configurationServer.once('close', done);
        configurationServer.close();
    });

    after('Stop partner server', (done) => {
        partnerServer.once('close', done);
        partnerServer.close();
    });
});
