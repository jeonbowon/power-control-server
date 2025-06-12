const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 메모리 기반 임시 저장소
let deviceStatus = {};         // 전력 상태 저장
let commandQueue = {};         // 장비별 명령 큐 저장

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Power Control Server is running!');
});


// ✅ [POST] /status - ESP32가 전력 상태 업로드
app.post('/status', (req, res) => {
  const { deviceId, voltage, current, power, energy, timestamp, powerOn } = req.body;

  if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

  deviceStatus[deviceId] = { voltage, current, power, energy, timestamp, powerOn };

  // ✅ 로그  
  console.log(`[STATUS] ✅ ${new Date().toISOString()} | ${deviceId} | 전류: ${current}A`);

  return res.json({ result: 'ok' });
});


// ✅ [GET] /status/:deviceId - 앱이 상태 조회
app.get('/status/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const data = deviceStatus[deviceId];

  if (!data) return res.status(404).json({ error: 'Device not found' });

  return res.json(data);
});


// ✅ [POST] /command - 앱이 ESP32에 명령 전송
app.post('/command', (req, res) => {
  const { deviceId, command, scheduleTime } = req.body;

  if (!deviceId || !command) return res.status(400).json({ error: 'deviceId and command required' });

  commandQueue[deviceId] = { command, scheduleTime };

  return res.json({ result: 'queued' });
});


// ✅ [GET] /command?deviceId=floor1 - ESP32가 명령 수신
app.get('/command', (req, res) => {
  const { deviceId } = req.query;

  if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

  const cmd = commandQueue[deviceId];

  if (cmd) {
    // 명령 한 번만 전송 → 삭제
    delete commandQueue[deviceId];
    return res.json(cmd);
  } else {
    return res.json({});
  }
});


// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
