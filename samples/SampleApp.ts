import AzureAI from "../lib/AzureAI";

const statsigServerKey = process.env.STATSIG_SERVER_KEY;
const apiEndpoint = process.env.DEPLOYMENT_ENDPOINT_URL;
const apiKey = process.env.DEPLOYMENT_KEY;

const messages = [
  { role: "system", content: "You are a helpful assistant. You will talk like a pirate." }, // System role not supported for some models
  { role: "user", content: "Can you help me?" },
  { role: "assistant", content: "Arrrr! Of course, me hearty! What can I do for ye?" },
  { role: "user", content: "What's the best way to train a parrot?" },
];

async function getModelClient() {
  await AzureAI.initialize(statsigServerKey);
  return AzureAI.getModelClientFromEndpoint(apiEndpoint, apiKey);
  // return AzureAI.getModelClient("gpt-4o-mini");
}

async function testComplete() {
  const modelClient = await getModelClient();

  try {
    const result = await modelClient.complete(messages);
    for (const choice of result.choices) {
      console.log(choice.message.content);
    }
  } catch (error) {
    console.error(error);
  }
  
  await AzureAI.shutdown();
}

async function testStreamComplete() {
  const modelClient = await getModelClient();

  try {
    const stream = await modelClient.streamComplete(messages, { max_tokens: 30 });
    for await (const event of stream) {
      if (event.data === '[DONE]') {
        await AzureAI.shutdown();
        return;
      }
      for (const choice of JSON.parse(event.data)?.choices) {
        process.stdout.write(choice.delta?.content ?? '');
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function testGetInfo() {
  const modelClient = await getModelClient();
  
  const result = await modelClient.getInfo();
  console.log(result);
  
  await AzureAI.shutdown();
}

// Use the embedding model for this test
async function testEmbeddings() {
  const modelClient = await getModelClient();
  
  const result = await modelClient.getEmbeddings(
    ['Hello, world!', 'Goodbye, world!'],  
  );
  for (const data of result.data) {
    console.log(`Embedding: ${data.embedding}`);
  }
  
  await AzureAI.shutdown();
}
/* Use chat completions model for these three tests */
// testComplete();
// testStreamComplete();
// testGetInfo();

/* Use an embedding model for this test */
testEmbeddings();