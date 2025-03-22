require("dotenv").config();
const tmi = require("tmi.js");
const Redis = require("redis");
const { QdrantClient } = require("@qdrant/js-client-rest");
const OpenAI = require("openai");
const { v4: uuidv4 } = require("uuid");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// Initialize Redis client
const redisClient = Redis.createClient({
  url: "redis://localhost:6379", // Default local Redis server URL
});

// Initialize Twitch client
const twitchClient = new tmi.Client({
  channels: [process.env.TWITCH_CHANNEL],
});

// Connect to Redis
async function main() {
  await redisClient.connect();

  // Check if collection exists
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === "kai_cenat_twitch_messages"
    );

    if (!collectionExists) {
      // Create Qdrant collection if it doesn't exist
      await qdrantClient.createCollection("kai_cenat_twitch_messages", {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small dimension size
          distance: "Cosine",
        },
      });
      console.log("Created new collection with correct vector size");
    } else {
      console.log("Collection already exists, skipping creation");
    }
  } catch (error) {
    console.error("Error checking/creating collection:", error.message);
  }
}

main().catch(console.error);

// Connect to Twitch
twitchClient.connect();

// Listen for chat messages
twitchClient.on("message", async (channel, tags, message, self) => {
  if (self) return; // Ignore messages from the bot itself

  const chatMessage = {
    channel,
    username: tags.username,
    message,
    timestamp: new Date().toISOString(),
  };

  // Save message to Redis
  await redisClient.lPush("chat_messages", JSON.stringify(chatMessage));
});

// Function to get CLIP embeddings from OpenAI
async function getEmbeddings(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  return response.data[0].embedding;
}

// Function to process Redis messages and store in Qdrant
async function processMessagesAndStore() {
  try {
    // Check if the Redis client is connected
    if (!redisClient.isOpen) {
      console.error(
        "Redis client is not connected. Attempting to reconnect..."
      );
      await redisClient.connect();
    }

    const messages = await redisClient.lRange("chat_messages", 0, -1);

    if (messages.length === 0) {
      console.log("No messages to process.");
      return;
    }

    for (const messageJson of messages) {
      const message = JSON.parse(messageJson);

      try {
        // Get embeddings for the message
        const embedding = await getEmbeddings(message.message);

        // Store in Qdrant with UUID
        await qdrantClient.upsert("kai_cenat_twitch_messages", {
          points: [
            {
              id: uuidv4(),
              vector: embedding,
              payload: {
                channel: message.channel,
                username: message.username,
                message: message.message,
                timestamp: message.timestamp,
              },
            },
          ],
        });

        console.log(`Stored embedding for message from ${message.username}`);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }

    // Clear Redis after successful processing
    await redisClient.del("chat_messages");
    console.log(`Processed ${messages.length} messages`);
  } catch (error) {
    console.error("Error in processMessagesAndStore:", error);
  }
}

// Schedule periodic processing (every 5 seconds)
setInterval(processMessagesAndStore, 5000);

console.log(
  "Twitch chat logger started with OpenAI embeddings and Qdrant storage."
);

// Ensure proper cleanup when the server is shutting down
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await redisClient.quit();
  process.exit(0);
});
