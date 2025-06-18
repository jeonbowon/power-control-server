// ✅ 산업용 전원 제어 시스템용 Node.js 서버
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// ✅ 장비별 상태 및 명령 저장소
let deviceStatus = {};      // 전류 및 설정값 저장
let commandQueue = {};      // SSR 제어 명령 저장
let deviceConfig = {};      // SSR 설정값 저장 (relay별)

// ✅ 기본 라우트
app.get('/', (req, res) => {
  res.send('Power Control Server is running');
});

// ✅ 1. 상태 업로드 (ESP32 → 서버)
app.post('/status', (req, res) => {
  const { deviceId, current, ...relayData } = req.body;
  if (!deviceId || typeof current !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  deviceStatus[deviceId] = { current, ...relayData, timestamp: Date.now() };

  // 로그  
  console.log(`[STATUS] ✅ ${new Date().toISOString()} | ${deviceId} → 전류: ${current}A`);
  console.log(`[STATUS] 상세데이터: ${JSON.stringify(relayData)}`);

  return res.json({ result: 'ok' });
});

// ✅ 2. 상태 조회 (Flutter 앱 → 서버)
app.get('/status/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const status = deviceStatus[deviceId];
  if (!status) return res.status(404).json({ error: 'Device not found' });

  console.log(`[STATUS-GET] 📲 앱에서 ${deviceId} 상태 조회`);

  return res.json(status);
});

// ✅ 3. SSR 제어 명령 전송 (앱 → 서버)
app.post('/command', (req, res) => {
  const { deviceId, command, relay } = req.body;
  if (!deviceId || !command || !relay) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  commandQueue[deviceId] = { command, relay };

  console.log(`[COMMAND] 📥 ${new Date().toISOString()} | 앱 → ${deviceId} | relay: ${relay} | 명령: ${command}`);

  return res.json({ result: 'queued' });
});

// ✅ 4. 명령 수신 (ESP32 → 서버)
app.get('/command', (req, res) => {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  const command = commandQueue[deviceId];
  if (command) {
    delete commandQueue[deviceId];	// 명령 한 번만 전송 → 삭제

    console.log(`[COMMAND] 📤 ${new Date().toISOString()} | ${deviceId} → ESP32 수신 | relay: ${command.relay} | 명령: ${command.command}`);
    
    return res.json(command);
  } else {
    console.log(`[COMMAND] ⏳ ${new Date().toISOString()} | ${deviceId} → 대기 중 (보낼 명령 없음)`);
    return res.json({});
  }
});

// ✅ 5. 설정값 수신 (ESP32가 부팅 시 요청)
app.get('/config', (req, res) => {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  const config = deviceConfig[deviceId];
  if (config) {
    console.log(`[CONFIG] 🔧 ${new Date().toISOString()} | ${deviceId} → ESP32 설정값 전송: ${JSON.stringify(config)}`);
    return res.json(config);
  } else {
    console.log(`[CONFIG] ❌ ${new Date().toISOString()} | ${deviceId} 설정값 없음`);
    return res.json({});
  }
});

// ✅ 6. 설정값 저장 (앱이 서버로 설정값을 보내는 경우)
app.post('/config', (req, res) => {
  const { deviceId, config } = req.body;
  if (!deviceId || typeof config !== 'object') {
    return res.status(400).json({ error: 'Invalid config' });
  }
  deviceConfig[deviceId] = config;

  console.log(`[CONFIG] 💾 ${new Date().toISOString()} | ${deviceId} → 앱 설정 저장: ${JSON.stringify(config)}`);
  return res.json({ result: 'saved' });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
