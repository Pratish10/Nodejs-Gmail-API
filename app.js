const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const TOKEN_PATH = 'token.json';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];

const client_secret = process.env.CLIENT_SECRET;
const client_id = process.env.CLIENT_ID;
const redirect_uris = process.env.REDIRECT_URI;

/**
 * Authorize the client using OAuth2 credentials.
 * If a valid token is available, use it; otherwise, obtain a new token.
 * @param {Object} credentials The OAuth2 credentials
 * @param {Function} callback The callback function to be executed after authorization
 */
function authorize(credentials, callback) {
    // const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Obtain a new token by generating an authorization URL and exchanging the authorization code.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client
 * @param {Function} callback The callback function to be executed after obtaining a new token
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);

            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });

            callback(oAuth2Client);
        });
    });
}

/**
 * Get the email address from the given email object.
 * @param {Object} email The email object
 * @returns {string} The email address
 */
function getEmailAddress(email) {
    if (email.payload && email.payload.headers) {
        const headers = email.payload.headers;
        const fromHeader = headers.find((header) => header.name === 'From');
        if (fromHeader) {
            const matches = fromHeader.value.match(/<([^>]+)>/); // Extract the content within angle brackets
            if (matches && matches.length > 1) {
                return matches[1];
            }
            return fromHeader.value;
        }
    }
    return '';
}

/**
 * Check for new unread emails and process them.
 * @param {google.auth.OAuth2} auth The authenticated OAuth2 client
 */
function checkForNewEmails(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    gmail.users.messages.list(
        { auth: auth, userId: 'me', labelIds: ['INBOX'], q: 'is:unread' },
        (err, res) => {
            if (err) return console.log('The API returned an error:', err.message);

            const emails = res.data.messages;
            if (emails.length) {
                console.log('New emails found:', emails.length);
                emails.forEach((email) => {
                    processEmail(auth, email);
                });
            } else {
                console.log('No new emails found.');
            }
        }
    );
}

/**
 * Send an auto-reply to the given email.
 * @param {google.auth.OAuth2} auth The authenticated OAuth2 client
 * @param {Object} email The email object
 */
function sendReply(auth, email) {
    const gmail = google.gmail({ version: 'v1', auth });

    const headers = {
        To: getEmailAddress(email),
        Subject: 'Automatic Reply',
    };

    const messageParts = [
        'Hello,',
        '',
        'Thank you for your email. I am currently on vacation and will not be able to respond until my return.',
        '',
        'Best regards,',
        'Pratish Ninawe',
    ];

    const emailLines = messageParts.slice(); // Copy the message parts array

    const emailContent = emailLines.join('\n');

    const utf8Subject = `=?utf-8?B?${Buffer.from(headers.Subject).toString('base64')}?=
`;

    const message = [
        `Content-Type: text/plain; charset="UTF-8"\n`,
        `MIME-Version: 1.0\n`,
        `Content-Transfer-Encoding: 7bit\n`,
        `to: ${getEmailAddress(email)}\n`,
        // `to: pratishninawe@gmail.com\n`,
        `subject: ${utf8Subject}\n\n`,
        `${emailContent}`,
    ].join('');

    const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    gmail.users.messages.send(
        {
            auth: auth,
            userId: 'me',
            resource: {
                raw: encodedMessage,
            },
        },
        (err, res) => {
            if (err) return console.log('The API returned an error:', err.message);

            console.log('Reply sent:', getEmailAddress(email));
        }
    );
}

/**
 * Process the given email by checking if it has been replied to, and if not, send an auto-reply.
 * @param {google.auth.OAuth2} auth The authenticated OAuth2 client
 * @param {Object} email The email object
 */
function processEmail(auth, email) {
    const gmail = google.gmail({ version: 'v1', auth });

    gmail.users.messages.get(
        { auth: auth, userId: 'me', id: email.id },
        (err, res) => {
            if (err) return console.log('The API returned an error:', err.message);

            const message = res.data;
            const headers = message.payload.headers;

            const isReplied = headers.some((header) => header.name === 'In-Reply-To');
            if (isReplied) {
                console.log('Email already replied:', getEmailAddress(email));
            } else {
                sendReply(auth, message);
                labelEmail(auth, email, 'Vacation Auto-Reply');
            }
        }
    );
}

/**
 * Label the given email with the specified label.
 * @param {google.auth.OAuth2} auth The authenticated OAuth2 client
 * @param {Object} email The email object
 * @param {string} labelName The name of the label to apply
 */
function labelEmail(auth, email, labelName) {
    const gmail = google.gmail({ version: 'v1', auth });

    gmail.users.messages.modify(
        {
            auth: auth,
            userId: 'me',
            id: email.id,
            resource: {
                addLabelIds: [createLabel(auth, labelName)],
                removeLabelIds: ['INBOX'],
            },
        },
        (err, res) => {
            if (err) return console.log('The API returned an error:', err.message);

            console.log('Email labeled:', getEmailAddress(email));
        }
    );
}

/**
 * Create a new label with the specified name.
 * @param {google.auth.OAuth2} auth The authenticated OAuth2 client
 * @param {string} labelName The name of the label to create
 * @returns {string} The ID of the created label
 */
function createLabel(auth, labelName) {
    const gmail = google.gmail({ version: 'v1', auth });

    gmail.users.labels.list({ auth: auth, userId: 'me' }, (err, res) => {
        if (err) return console.log('The API returned an error:', err.message);

        const labels = res.data.labels;
        const label = labels.find((l) => l.name === labelName);
        if (label) {
            console.log('Label already exists:', labelName);
        } else {
            gmail.users.labels.create(
                { auth: auth, userId: 'me', resource: { name: labelName } },
                (err, res) => {
                    if (err) return console.log('The API returned an error:', err.message);

                    console.log('Label created:', labelName);
                }
            );
        }
    });
}

/**
 * Start the auto-responder by checking for new emails at random intervals.
 */
function startAutoResponder() {
    const interval = getRandomInterval();

    setTimeout(() => {
        fs.readFile('credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err.message);

            authorize(JSON.parse(content), checkForNewEmails);
            startAutoResponder(); // Call the function recursively
        });
    }, interval);
}

/**
 * Generate a random interval between 45 and 120 seconds (in milliseconds).
 * @returns {number} The random interval
 */
function getRandomInterval() {
    return Math.floor(Math.random() * (120000 - 45000 + 1)) + 45000;
}

// Load credentials and start the auto-responder
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err.message);

    authorize(JSON.parse(content), checkForNewEmails);
    startAutoResponder();
});
