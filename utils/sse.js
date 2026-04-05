const { v4: uuidv4 } = require("uuid");

function createEventBroadcaster() {
  /** @type {Map<string, {id:string,res:import('http').ServerResponse,userId:number|null}>} */
  const clients = new Map();
  const MAX_CONNECTIONS_PER_USER = 5;

  function write(res, data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      // ignore broken pipe
    }
  }

  function countUserConnections(userId) {
    if (userId == null) return 0;
    const uid = Number(userId);
    let count = 0;
    for (const c of clients.values()) {
      if (c.userId != null && Number(c.userId) === uid) count++;
    }
    return count;
  }

  function addClient(res, userId = null) {
    const uid = userId != null ? Number(userId) : null;

    // Enforce per-user connection limit
    if (uid != null && countUserConnections(uid) >= MAX_CONNECTIONS_PER_USER) {
      // Close oldest connection for this user
      for (const [key, c] of clients.entries()) {
        if (c.userId != null && Number(c.userId) === uid) {
          try { c.res.end(); } catch {}
          clients.delete(key);
          break;
        }
      }
    }

    const id = uuidv4();
    const client = { id, res, userId: uid };
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
