# MailBot
With the help of MailBot you do not have to worry about replying to your emails when you are busy for a few days. MailBot automatically fetches your unread emails and replies with a message letting the reciever know about your unavailability.

This app was created using Node.js. It uses the Gmail API to connect to your Gmail ID. It can read and reply to all of your unread emails with a custom message. You would need to create a project in Google Cloud Console to run this app.

## How to run

- Firstly you would require npm and Node.js installed in your system and you will also require a google cloud project.
- Configure the OAuth consent screen (https://developers.google.com/gmail/api/quickstart/nodejs#configure_the_oauth_consent_screen), Be sure to add your email in the test users
- Authorize credentials for a desktop application (https://developers.google.com/gmail/api/quickstart/nodejs#authorize_credentials_for_a_desktop_application)
- After pasting the credentials.json file in the working directory, run the command
  ```
  npm init
  ```
- After completion run the file
  ```
  node .
  ```

