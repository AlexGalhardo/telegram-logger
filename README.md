<div align="center">
	<h1 align="center"><a href="https://jsr.io/@alexgalhardo/telegram-logger" target="_blank">@alexgalhardo/telegram-logger</a></h1>
</div>

## Introduction

- Simple logger for Telegram

## How to use

1. Install package
```bash
bunx jsr add @alexgalhardo/telegram-logger
```

2. Getting `TELEGRAM_BOT_HTTP_TOKEN`:
   - a. Find BotFather in Telegram to create new bots
   - b. Start a conversation with BotFather typing: `/newbot`
   - c. Create a name and username for your new bot
   - d. Save the `TELEGRAM_BOT_HTTP_TOKEN` BotFather will answer to you
   - e. BotFather will also give you the link to start conversation with your new bot: `t.me/YOUR_BOT_NAME`

3. Getting `TELEGRAM_BOT_CHANNEL_ID`
   - a. Send a aleatory message to your new bot you created previously
   - b. Access: `https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_HTTP_TOKEN_HERE>/getUpdates`
   - c. Copy and save: `chat.id` its a number

4. Create logger
```js
import TelegramLogger from "@alexgalhardo/telegram-logger";

const logger = new TelegramLogger(TELEGRAM_BOT_HTTP_TOKEN, TELEGRAM_BOT_CHANNEL_ID);

logger.error('Something went wrong');
logger.info('Some info message');
```

## Example

<img width="1013" alt="Screenshot 2024-06-14 at 12 54 18" src="https://github.com/AlexGalhardo/telegram-logger/assets/19540357/e1775fa5-4617-480f-a4df-f4f947c350a5">

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) August 2023-present, [Alex Galhardo](https://github.com/AlexGalhardo)


