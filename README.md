# socialight

This app is intended to help create and strengthen connections with people in your workspace. It randomly pairs you with a set of colleagues, and suggests a date for you to meet up and have coffee/dinner.

It runs standalone on any server capable of hosting node apps, and will automatically connect to whatever slack workspace it is installed to. The bot then uses slack to communicate with all participants through dm and announcements.

## Setup

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

### Slack tokens

The required environment variables can be found in the slack API web interface after creating a slack app with the required permissions.

* SLACK_BOT_TOKEN
Starts with *xoxb-* and can be found under Features -> OAuth & Permissions.

* SLACK_SIGNING_SECRET
Can be found under Settings -> Basic Information -> App Credentials

* SLACK_APP_TOKEN
Starts with *xapp-* and is found under Settings -> Basic Information -> App-Level Tokens

### Events

* POOL_CHANNELS
Comma separated list of channel names to run events for. Omit # prefix.

* ANNOUNCEMENTS_CHANNEL
Name of channel where the bot announces shared information, such as successfully planned events. Omit # prefix.

* PARTICIPANTS
Number of participants per event.

## Slack app setup

All configuration values needed for connecting with slack are provided as environment variables. Refer to the .env.example file for which ones are needed to run the bot.

### Socket mode

The app runs in socket mode, because this allows for much easier development. Just start the app, and it will find and connect to accessible workspaces through the use of bolt and bot secret configurations.

### Required scopes:
* channels:read
* chat:write
* im:history
* users:read