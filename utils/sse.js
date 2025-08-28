const { v4: uuidv4 } = require("uuid");

function createEventBroadcaster() {
  /** @type {Map<string, {id:string,res:import('http').ServerResponse,userId:number|null}>} */
  const clients = new Map();

  function write(res, data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // ignore broken pipe
    }
  }

  function addClient(res, userId = null) {
    const id = uuidv4();
    const client = { id, res, userId: userId != null ? Number(userId) : null };
    clients.set(id, client);
    // Keep-alive pings every 25s to prevent proxies from closing the connection
    const pingInterval = setInterval(() => {
      try { write(res, { type: "ping", t: Date.now() }); } catch {}
    }, 25000);
    res.on("close", () => {
      clearInterval(pingInterval);
      clients.delete(id);
    });
    return client;
  }

  function removeClient(id) {
    clients.delete(id);
  }

  function send(clientOrId, payload) {
    const client = typeof clientOrId === "string" ? clients.get(clientOrId) : clientOrId;
    if (!client) return;
    write(client.res, payload);
  }

  function broadcast(payload) {
    for (const c of clients.values()) write(c.res, payload);
  }

  function broadcastToUser(userId, payload) {
    const uid = Number(userId);
    for (const c of clients.values()) {
      if (c.userId != null && Number(c.userId) === uid) write(c.res, payload);
    }
  }

  function broadcastToUsers(userIds, payload) {
    const set = new Set((userIds || []).map((u) => Number(u)));
    for (const c of clients.values()) {
      if (c.userId != null && set.has(Number(c.userId))) write(c.res, payload);
    }
  }

  return {
    addClient,
    removeClient,
    send,
    broadcast,
    broadcastToUser,
    broadcastToUsers,
  };
}

module.exports = { createEventBroadcaster };
