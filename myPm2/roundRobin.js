class Server {
  constructor(url, weight) {
    this.url = url;
    this.weight = weight;
  }
}

class RoundRobin {
  constructor(servers) {
    this.servers = servers || [];
    this.currentServer = null;
  }

  addServer(server) {
    this.servers.push(server);
  }

  removeServer(id) {
    this.servers = this.servers.filter(s => {
      return s.url !== id;
    });
  }

  chooseServer() {
    let FreeServer;
    this.servers.forEach(i => {
      if (i !== this.currentServer) {
        if (!FreeServer) {
          FreeServer = i;
        }
        if (i.weight < FreeServer.weight) {
          FreeServer = i;
        }
      }
    });
    FreeServer.weight += 1;
    this.currentServer = FreeServer;
    return FreeServer;
  }
}

module.exports = {
  RoundRobin,
  Server,
};
