import { createServer } from 'http';
import { config } from './config.js';

export const configurationServer = createServer((req, res) => {
    const configurationData = 'DARealm=PassportTest'
        + `,DALogin=${config.AUTHENTICATION_SERVER_URL}`
        + ',DAReg=https://error.localhost/'
        + ',Properties=https://editprofile.localhost/'
        + ',Privacy=https://privacy.localhost/'
        + ',GeneralRedir=https://generalredir.localhost/'
        + ',Help=https://help.localhost/'
        + ',ConfigVersion=1';

    res.setHeader('PassportURLs', configurationData);
    res.writeHead(200);
    res.end();
});

