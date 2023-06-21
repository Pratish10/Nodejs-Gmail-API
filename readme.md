## Appendix

1. Check for new emails in a given Gmail ID.
2. Send replies to Emails that have no prior replies.
3. Add a Label to the email and move the email to the label.
4. Repeat this sequence of steps 1-3 in random intervals of 45 to 120 seconds.

Download all the source code Including Project setup and explanation video from this link - https://drive.google.com/drive/folders/1Cg0Wh_HI2I2geLIa2s5gG8J25lIoq7GU?usp=sharing

Download all the dependencies using `npm install`.

Follow `GCP Setup.mkv` video to configure and setup the Gmail API including the credentials.

Follow `Project Explanation.mkv` video to implement the credentials and token. Remember the access token is valid only for 3599 seconds which is enough.

Place your CLIENT_ID and CLIENT_SECRET in the `.env` file respectively.

.env

```bash
    CLIENT_ID="Your client ID" \
    CLIENT_SECRET="your client secret"
    REDIRECT_URI=https://developers.google.com/oauthplayground
```

Copy and paste the json data which generated in `REDIRECT_URI` in the file token.json

token.json

```bash
    {
        "access_token": "your access token",
        "scope": "https://mail.gmail.google.com/",
        "token_type": "Bearer",
        "expires_in": 3599,
        "refrsh_token": "your refresh token"
    }
```

Run the app.js file by using `node app.js`

This project is an assignment for the role of Nodejs Development Internship for the Listed company.
