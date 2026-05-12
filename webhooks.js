const webhookCache = {};

async function getOrCreateThreadWebhook(thread) {
  if (webhookCache[thread.id]) {
    return webhookCache[thread.id];
  }

  try {
    const webhooks = await thread.fetchWebhooks();
    let webhook = webhooks.first();

    if (!webhook) {
      webhook = await thread.createWebhook({
        name: `RP Thread ${thread.name}`
      });
    }

    webhookCache[thread.id] = webhook;
    return webhook;
  } catch (error) {
    console.error('Error getting/creating thread webhook:', error);
    return null;
  }
}

module.exports = { getOrCreateThreadWebhook };