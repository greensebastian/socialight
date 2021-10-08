# socialight

This app is intended to help create and strengthen connections with people in your workspace. It randomly pairs you with a set of colleagues, and suggests a date for you to meet up and have coffee/dinner.

It runs standalone on any server capable of hosting node apps, and will automatically connect to whatever slack workspace it is installed to. The bot then uses slack to communicate with all participants through dm and announcements.

## Slack setup

All configuration values needed for connecting with slack are provided as environment variables. Refer to the .env.example file for which ones are needed to run the bot.

### Socket mode

The app runs in socket mode, because this allows for much easier development. Just start the app, and it will find and connect to accessible workspaces through the use of bolt and bot secret configurations.

### Required scopes:
* channels:read
* chat:write
* im:history
* users:read