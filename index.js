const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const repliedThreads = [];

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  console.log(client);
  return client;
}

/*
1.This function will reply a custom message to an email
2.It also populates the repliedThreads array to check for repetitive responses
*/
async function sendReply(auth, threadId, senderEmail) {
  try {
    const gmail = google.gmail({ version: "v1", auth });

    const message = `This is a reply to your mail`;

    const emailContent =
      `To: ${senderEmail}\r\n` +
      `Subject: Re: Automated Reply\r\n` +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `References: ${threadId}\r\n\r\n` +
      message;

    const encodedEmail = Buffer.from(emailContent).toString("base64");

    await gmail.users.messages.send({
      userId: "me",
      resource: {
        raw: encodedEmail,
      },
    });

    console.log("Reply sent!");
    repliedThreads.push({ threadId, senderEmail });
  } catch (error) {
    console.log("Couldn't send email, Error:", error);
  }
}

/*
This function extracts the senders email
*/ 
function extractSenderEmail(email) {
  const headers = email.data.payload.headers;
  for (const header of headers) {
    if (header.name === "From") {
      return header.value;
    }
  }
  return "";
}

/*
This function checks the repliedThreads array if an email thread has already been replied to
*/
function checkIfRepliedBefore(threadId, senderEmail) {
  return repliedThreads.some(
    (thread) =>
      thread.threadId === threadId && thread.senderEmail === senderEmail
  );
}

/*
This function generates a custom label for the user if the label doesn't exists already
*/
async function createLabel(auth, labelName) {
  const gmail = google.gmail({ version: "v1", auth });

  const labels = await gmail.users.labels.list({ userId: "me" });

  const existingLabel = labels.data.labels.find(
    (label) => label.name === labelName
  );

  if (existingLabel) {
    return existingLabel;
  } else {
    const newLabel = await gmail.users.labels.create({
      userId: "me",
      resource: { name: labelName },
      messageListVisibility: "show",
      labelListVisibility: "labelShow",
    });
    return newLabel;
  }
}

/*
1.This function gets the top few unread emails depending on value of maxResults, if none are found then it returns
2.It logs the retrieved emails and check if it had been replied to previously
3.If it wasn't replied to then it calls the sendReply function for it
4.It also removes the UNREAD label from the email
*/ 
async function listAndReplyToUnreadEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread",
    maxResults: 1,
  });

  const messages = res.data.messages;

  if (!messages || messages.length === 0) {
    console.log("No new emails found.");
    return;
  }

  console.log("New Emails:");

  for (const message of messages) {
    console.log(`Email ID: ${message.id}`);

    const email = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
    });

    const subjectHeader = email.data.payload.headers.find(
      (header) => header.name === "Subject"
    );

    const emailSubject = subjectHeader ? subjectHeader.value : "No Subject";
    console.log(`Subject: ${emailSubject}`);

    const threadId = email.data.threadId;
    const senderEmail = extractSenderEmail(email);

    if (!checkIfRepliedBefore(threadId, senderEmail)) {
      await sendReply(auth, threadId, senderEmail);
      const label = await createLabel(auth, "RepliedByBot");
      await gmail.users.messages.modify({
        userId: "me",
        id: message.id,
        resource: {
          removeLabelIds: ["UNREAD"],
          addLabelIds: [label.id],
        },
      });
    } else {
      console.log("Replied Already");
    }
  }
}

/*
1.This function starts the main execution of the app by calling the authorize function
2.The authorization function when fulfilled calls the listAndReplyToUnreadEmails function which replies to top few unread emails depedning on the maxResults value we provide
3.This execution keeps going on with random interval between 45 to 120 seconds 
*/
async function execute() {
  try {
    await authorize().then(listAndReplyToUnreadEmails).catch(console.error);

    const minInterval = 45000;
    const maxInterval = 120000;

    const randomInterval = Math.floor(
      Math.random() * (maxInterval - minInterval + 1) + minInterval
    );

    console.log(`Next execution in ${randomInterval / 1000} seconds`);
    setTimeout(execute, randomInterval);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

execute();

//no reply
//prev unread emails
