# Twitch Chat Qdrant Upsert

A Node.js application that listens to Twitch chat messages, temporarily stores them in Redis, and periodically dumps them to a Qdrant database.

## Features

- Real-time Twitch chat message capture
- Temporary storage in Redis for efficient handling
- Periodic dumping of messages to Qdrant for long-term storage
- Configurable settings via environment variables

## Prerequisites

- Node.js (version 14 or higher)
- Qdrant cluster
- Twitch channel name

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/twitch-chat-logger.git
   cd twitch-chat-logger
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables:

   ```
   QDRANT_URL=your_qdrant_url
   QDRANT_API_KEY=your_qdrant_api_key
   OPENAI_API_KEY=your_openai_api_key
   TWITCH_CHANNEL=channel_name
   ```

4. Set up the PostgreSQL database:
   Create a table named `twitch_chat_messages` with the following schema:
   ```sql
   CREATE TABLE twitch_chat_messages (
     id SERIAL PRIMARY KEY,
     channel VARCHAR(255) NOT NULL,
     username VARCHAR(255) NOT NULL,
     message TEXT NOT NULL,
     timestamp TIMESTAMP NOT NULL
   );
   ```

## Usage

Start the application:
