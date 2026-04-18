const { exec } = require('child_process');
const http = require('http');

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;
const SERVER_PORTS = Array.from({ length: 11 }, (_, i) => 4000 + i); // [4000, 4001, ..., 4010]

let attempt = 0;

function checkServer(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 1500,
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve({ port, healthy: true });
      } else {
        resolve({ port, healthy: false, status: res.statusCode });
      }
    });

    req.on('error', () => {
      resolve({ port, healthy: false, status: 'unreachable' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ port, healthy: false, status: 'timeout' });
    });

    req.end();
  });
}

async function findHealthyServer() {
  console.log(`\nSearching for healthy server on ports ${SERVER_PORTS.join(', ')}...`);
  for (const port of SERVER_PORTS) {
    const result = await checkServer(port);
    if (result.healthy) {
      console.log(`✅ Found healthy server on port ${port}.`);
      return port;
    } else {
      console.log(`- Port ${port} is not ready (Status: ${result.status}).`);
    }
  }
  return null;
}

function startClient(serverPort) {
  console.log(`\n🚀 Starting client, connecting to API on port ${serverPort}...`);

  // Set the port for the client's environment
  const clientEnv = { ...process.env, VITE_API_BASE_URL: `http://localhost:${serverPort}` };

  const clientProcess = exec('npm run dev --workspace client', { env: clientEnv });

  clientProcess.stdout.pipe(process.stdout);
  clientProcess.stderr.pipe(process.stderr);

  clientProcess.on('exit', (code) => {
    console.log(`\nClient process exited with code ${code}`);
    process.exit(code ?? 0);
  });

  clientProcess.on('error', (error) => {
    console.error(`Failed to start client process: ${error.message}`);
    process.exit(1);
  });
}

async function main() {
  while (attempt < MAX_RETRIES) {
    attempt++;
    console.log(`\n[Attempt ${attempt}/${MAX_RETRIES}]`);
    const healthyPort = await findHealthyServer();

    if (healthyPort) {
      startClient(healthyPort);
      return;
    }

    if (attempt < MAX_RETRIES) {
      console.log(`No healthy server found. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.error(`\n❌ Server did not become healthy after ${MAX_RETRIES} attempts. Aborting.`);
  process.exit(1);
}

main();
