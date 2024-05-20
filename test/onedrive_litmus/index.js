import dotenv from 'dotenv';
dotenv.config()
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import path, { resolve, join } from 'path';
import { writeFileSync, readFileSync } from 'fs';
import { assert } from 'chai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = resolve(__dirname, 'fixtures');
const stdoutFixturePath = join(fixturesDir, 'stdout');
const stderrFixturePath = join(fixturesDir, 'stderr');

const cid = process.env.ONEDRIVE_CID;
const username = process.env.ONEDRIVE_USERNAME;
const password = process.env.ONEDRIVE_PASSWORD;

if (!cid || !username || !password) {
    throw new Error('To run the OneDrive litmus test, the environment variables ONEDRIVE_CID, ONEDRIVE_USERNAME and'
        + ' ONEDRIVE_PASSWORD must be set.');
}

const command = `docker run --link passport-proxy:proxy litmus http://proxy:3000/${cid}/ '${username}' '${password}'`;

function run(callback) {
    exec(command, (error, stdout, stderr) => {
        callback(stdout, stderr);
    });
}

if (process.argv[2] === '--write-fixtures') {
    run((stdout, stderr) => {
        writeFileSync(stdoutFixturePath, stdout);
        writeFileSync(stderrFixturePath, stderr);

        console.log('Fixtures written.');
    });
} else {
    describe('run litmus WebDAV test suite against the passport proxy with OneDrive as target', () => {
        it('should produce the expected results', function (done) {
            this.timeout(60 * 1000); // 60 seconds

            run((stdout, stderr) => {
                const stdoutFixture = readFileSync(stdoutFixturePath, 'utf8');
                const stderrFixture = readFileSync(stderrFixturePath, 'utf8');

                assert.strictEqual(stdout, stdoutFixture);
                assert.strictEqual(stderr, stderrFixture);

                done();
            });
        });
    });
}
