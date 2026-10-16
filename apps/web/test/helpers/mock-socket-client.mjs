export function io() {
  return {
    on: () => {},
    off: () => {},
    once: () => {},
    emit: (event, data, cb) => {
      if (typeof cb === 'function') cb({ success: true });
    },
    disconnect: () => {},
    connected: false,
    io: { on: () => {} },
  };
}

const mockSocketClient = { io };
export default mockSocketClient;
