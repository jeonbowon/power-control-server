// ✅ 산업용 전원 제어 시스템용 Node.js 서버
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');  // ✅ JWT 사용 추가
dotenv.config();

const LOGIN_ID = process.env.LOGIN_ID;
const LOGIN_PW = process.env.LOGIN_PW;

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'tnbsoft_secret'; // ✅ 토큰 서명용 키 (환경변수 또는 기본값)

app.use(cors());
app.use(express.json());

// ✅ 장비별 상태 및 명령 저장소
let deviceStatus = {};      	// 전류 및 설정값 저장
let commandQueue = {};      // SSR 제어 명령 저장
let deviceConfig = {};      	// SSR 설정값 저장 (relay별)

// ✅ JWT 인증 미들웨어 정의
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: '인증 헤더 없음' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '토큰 없음' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: '토큰 유효하지 않음' });
    req.user = user;
    next();
  });
}

// ✅ 기본 라우트
app.get('/', (req, res) => {
  res.send('Power Control Server is running');
});

// ✅ 로그인 API - JWT 발급
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === LOGIN_ID && password === LOGIN_PW) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '30s' }); 	//'1h' });
    console.log(`[LOGIN] ✅ ${username} 로그인 성공`);
    return res.json({ token });
  } else {
    console.log(`[LOGIN] ❌ 로그인 실패 (${username})`);
    return res.status(401).json({ error: '아이디 또는 비밀번호 오류' });
  }
});


// ✅ 1. 상태 업로드 (ESP32 → 서버) → 인증 불필요
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

// ✅ 2. 상태 조회 (Flutter 앱 → 서버) → 인증 필요
app.get('/status/:deviceId', verifyToken, (req, res) => {
  const { deviceId } = req.params;
  const status = deviceStatus[deviceId];
  if (!status) return res.status(404).json({ error: 'Device not found' });

  console.log(`[STATUS-GET] 📲 앱에서 ${deviceId} 상태 조회`);

  return res.json(status);
});

// ✅ 3. SSR 제어 명령 전송 (앱 → 서버) → 인증 필요
app.post('/command', verifyToken, (req, res) => {
  const { deviceId, command, relay } = req.body;
  if (!deviceId || !command || !relay) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  commandQueue[deviceId] = { command, relay };

  console.log(`[COMMAND] 📥 ${new Date().toISOString()} | 앱 → ${deviceId} | relay: ${relay} | 명령: ${command}`);

  return res.json({ result: 'queued' });
});

// ✅ 4. 명령 수신 (ESP32 → 서버) → 인증 불필요
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

// ✅ 5. 설정값 수신 (ESP32 → 서버) → 인증 불필요
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

// ✅ 6. 설정값 저장 (앱이 서버로 설정값을 보내는 경우) → 인증 필요
app.post('/config', verifyToken, (req, res) => {
  const { deviceId, config } = req.body;
  if (!deviceId || typeof config !== 'object') {
    return res.status(400).json({ error: 'Invalid config' });
  }
  deviceConfig[deviceId] = config;

  console.log(`[CONFIG] 💾 ${new Date().toISOString()} | ${deviceId} → 앱 설정 저장: ${JSON.stringify(config)}`);
  return res.json({ result: 'saved' });
});

// ✅ 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
