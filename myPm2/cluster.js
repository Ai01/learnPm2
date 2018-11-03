const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const http = require('http');
const url = require('url');

const { RoundRobin, Server } = require('./roundRobin');

// const eachworker = (cluster, callback) => {
//   if (cluster && cluster.workers) {
//     for (var id in cluster.workers) {
//       callback(cluster.workers[id]);
//     }
//   }
// };

// TODO:bai 代码的重新整理
// 第一部将master和worker写成class

class Mater {
  // TODO:bai master中应该有哪些操作
  constructor(cluster) {
    this.workers = [];
    this.cluster = cluster;
    this.Servers = new RoundRobin();

    console.log('[master] ' + 'start master...');
  }

  createWorkers() {
    for (var i = 0; i < numCPUs; i++) {
      // 得以实现master-worker模型的根本
      const res = this.cluster.fork();
      this.Servers.addServer(new Server(res.id, 0));
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log('[master] ' + 'exit worker' + worker.id + ' died');
      this.Servers.removeServer(worker.id);
      // 实现进程死亡的重启
      const res = cluster.fork();
      this.Servers.addServer(new Server(res.id, 0));
    });
  }

  // TODO:bai 将round-robin对Master的侵入改为传入workers
  addWorker(worker) {
    this.workers.push(worker);
  }

  netWorkProxy() {
    // http代理部分
    const request = (cReq, cRes) => {
      const u = url.parse(cReq.url);

      // 在这里实现对请求的过滤(favicon.ico)
      if (u.pathname === '/favicon.ico') {
        cRes.end('test');
        return;
      }

      const getOptions = () => {
        return {
          hostname: 'localhost',
          port: 4000 + this.Servers.chooseServer().url,
          path: u.path,
          method: cReq.method,
          headers: cReq.headers,
        };
      };

      const pReq = http
        .request(getOptions(), pRes => {
          cRes.writeHead(pRes.statusCode, pRes.headers);
          pRes.pipe(cRes);
        })
        .on('error', e => {
          cRes.end();
        });

      cReq.pipe(pReq);
    };

    return request;
  }

  createServer() {
    const masterPort = 3002;

    // 延迟发出请求防止worker没有建立
    setTimeout(() => {
      http
        .createServer()
        .on('request', this.netWorkProxy())
        .listen(masterPort, () => {
          console.log(`master start at http://localhost:${masterPort}`);
        });
    }, 10000);
  }
}

class Worker {
  constructor(cluster) {
    this.cluster = cluster;

    console.log('[worker] ' + 'start worker ...' + cluster.worker.id);
  }

  prepareWorker() {
    process.on('message', function(msg) {
      if (msg === 'kill') {
        process.exit();
      }
    });
  }

  createServer() {
    const port = 4000 + parseInt(cluster.worker.id);

    http
      .createServer((req, res) => {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('worker' + this.cluster.worker.id + ',PID:' + process.pid);
      })
      .listen(port, () => {
        console.log(`http://localhost:${port}`);
      });
  }
}

if (cluster.isMaster) {
  // master 进程
  // 负责将请求转发给worker
  // 负责调度worker的死亡和重启

  // // 模拟worker进程死亡
  // setTimeout(function() {
  //   eachWorker(cluster, worker => {
  //     worker.send('kill');
  //   });
  // }, 3000);

  const myMaster = new Mater(cluster);
  myMaster.createWorkers();
  myMaster.createServer();
} else if (cluster.isWorker) {
  // worker 进程
  const myWorker = new Worker(cluster);
  myWorker.prepareWorker();
  myWorker.createServer();
}
