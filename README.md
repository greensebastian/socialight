# socialight

This app is intended to help create and strengthen connections with people in your workspace. It randomly pairs you with a set of colleagues, and suggests a date for you to meet up and have coffee/dinner.

It runs standalone on any server capable of hosting node apps, and will automatically connect to whatever slack workspace it is installed to. The bot then uses slack to communicate with all participants through dm and announcements.

# Usage

Communication with the bot happens through direct messaging and block actions. In production mode it only has a fallback "i don't know what that means" response to all free text, but in development mode there are more commands. As a rule of thumb, the bot should respond to **all** commands one way or another to let the user know the command was at the very least received.

## Invitations

When a person is invited to an event, they will receive a dm from the bot with information on what channel the invite originated from and how to respond.

## Accepting and declining

After being invited to an event, a user can accept or decline events one at a time through the accept and decline commands. You can't change your response to an invite after sending accept or decline.

## Listing events

A list of all events the user is involved in is available on the home page of the app.

## Announcements

When an event has enough accepted invites to match the configured number of participants, the event is announced to the announcement channel as well as individually to all users who accepted.

## Opting in and out

Users can opt in and out from the app home page if they dont want to partake in the events. Opting out has no effect on existing invites.

# Setup

```bash
git clone https://github.com/greensebastian/socialight.git
cd socialight
npm install
cp .env.example .env
```

Create slack app, install to workspace, and set up environment variables according to the configuration section.

```bash
npm start
```

## Configuration

* DEVELOPMENT

When set to *true*, additional handlers are added to allow for debugging/testing with slack messages.

### Slack tokens

The required environment variables can be found in the slack API web interface after creating a slack app with the required permissions.

* SLACK_BOT_TOKEN

Starts with *xoxb-* and can be found under Features -> OAuth & Permissions.

* SLACK_SIGNING_SECRET

Can be found under Settings -> Basic Information -> App Credentials

* SLACK_APP_TOKEN

Starts with *xapp-* and is found under Settings -> Basic Information -> App-Level Tokens. This token is only required if you want to use socket mode, which can be beneficial during testing and development.

### Events

* POOL_CHANNELS

Comma separated list of channel names to run events for. Omit # prefix.

* ANNOUNCEMENTS_CHANNEL

Name of channel where the bot announces shared information, such as successfully planned events. Omit # prefix.

* PARTICIPANTS

Number of participants per event.

### Invites

* START_OF_DAY

The bot will not send direct messages before this time.

* END_OF_DAY

The bot will not send direct messages after this time.

### TLS

In order to support HTTPS when using the events API, you need a valid certificate and private key that the node server can use.

* TLS_PRIVKEY

.pem file containing the private key

* TLS_CERT

.pem file containing the public certificate

## Slack app setup

All configuration values needed for connecting with slack are provided as environment variables. Refer to the .env.example file for which ones are needed to run the bot.

The bot manifest file can be used to quickly get the app configured in the slack interface.

### Event subscription

The app needs to expose an endpoint which the slack service can use to post events.

### Required scopes:
* channels:read
* chat:write
* groups:read
* im:history
* im:write
* users:read