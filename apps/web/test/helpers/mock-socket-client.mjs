export const mockSockets = [];

export function io(url, options) {
  const handlers = new Map();
  const socket = {
    url,
    options,
    requests: [],
    on: (event, callback) => {
      handlers.set(event, callback);
    },
    off: () => {},
    once: () => {},
    emit: (event, data, cb) => {
      socket.requests.push({ event, data });
      if (typeof cb === 'function') cb({ success: true });
    },
    disconnect: () => {},
    connected: false,
    io: { on: () => {} },
    serverEmit: (event, payload) => {
      if (event === 'support.connected') socket.connected = true;
      if (event === 'disconnect' || event === 'support.error')
        socket.connected = false;
      handlers.get(event)?.(payload);
    },
  };
  mockSockets.push(socket);
  return socket;
}

const mockSocketClient = { io };
export default mockSocketClient;
