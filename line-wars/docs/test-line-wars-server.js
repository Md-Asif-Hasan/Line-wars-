// ─── Line Wars Server Test Script ─────────────────────────────────────────────────

const WebSocket = require('ws');

// Test configuration
const SERVER_URL = 'ws://localhost:8080';
const TEST_BATTLE_ID = 'test-battle-123';
const TEST_UID_1 = 'test-user-1';
const TEST_UID_2 = 'test-user-2';

console.log('🎮 Testing Line Wars Server-Authoritative Implementation');
console.log('='.repeat(60));

let ws1 = null;
let ws2 = null;
let gameStateUpdates = 0;
let player1Joined = false;
let player2Joined = false;

function createTestClient(uid, name) {
  return new Promise((resolve, reject) => {
    console.log(`📡 Connecting ${name} to ${SERVER_URL}...`);
    
    const ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
      console.log(`✅ ${name} connected`);
      
      // Join game
      ws.send(JSON.stringify({
        type: 'joinGame',
        gameId: TEST_BATTLE_ID,
        uid: uid
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'connected':
          console.log(`🔗 ${name} received client ID: ${message.clientId}`);
          resolve(ws);
          break;
          
        case 'joinedGame':
          console.log(`🎯 ${name} joined as ${message.playerSlot}`);
          if (message.playerSlot === 'player1') player1Joined = true;
          if (message.playerSlot === 'player2') player2Joined = true;
          break;
          
        case 'gameState':
          gameStateUpdates++;
          if (gameStateUpdates % 10 === 0) {
            console.log(`📊 ${name}: Game state update #${gameStateUpdates}, Status: ${message.state.gameStatus}`);
          }
          
          // Test sending input when game is playing
          if (message.state.gameStatus === 'playing') {
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'playerInput',
                gameId: TEST_BATTLE_ID,
                uid: uid,
                data: { direction: Math.random() * Math.PI * 2 }
              }));
            }, 1000);
          }
          break;
          
        case 'error':
          console.error(`❌ ${name} error: ${message.error}`);
          break;
      }
    });
    
    ws.on('error', (error) => {
      console.error(`❌ ${name} WebSocket error:`, error);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log(`🔌 ${name} disconnected`);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!ws.readyState === WebSocket.OPEN) {
        reject(new Error(`${name} connection timeout`));
      }
    }, 10000);
  });
}

async function runTest() {
  try {
    // Connect both players
    ws1 = await createTestClient(TEST_UID_1, 'Player 1');
    ws2 = await createTestClient(TEST_UID_2, 'Player 2');
    
    // Wait for both players to join
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (player1Joined && player2Joined) {
          clearInterval(checkInterval);
          console.log('🎮 Both players joined successfully!');
          resolve();
        }
      }, 100);
    });
    
    // Test game actions
    console.log('🎯 Testing game actions...');
    
    setTimeout(() => {
      if (ws1 && ws1.readyState === WebSocket.OPEN) {
        ws1.send(JSON.stringify({
          type: 'gameAction',
          gameId: TEST_BATTLE_ID,
          uid: TEST_UID_1,
          data: { type: 'draw_request', timestamp: Date.now() }
        }));
        console.log('📤 Player 1 sent draw request');
      }
    }, 2000);
    
    // Monitor for a few seconds
    setTimeout(() => {
      console.log(`📊 Total game state updates received: ${gameStateUpdates}`);
      console.log('🎮 Test completed successfully!');
      
      // Cleanup
      if (ws1) ws1.close();
      if (ws2) ws2.close();
      
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
console.log('🔍 Checking if Line Wars server is running...');
const testWs = new WebSocket(SERVER_URL);

testWs.on('open', () => {
  console.log('✅ Server is running!');
  testWs.close();
  runTest();
});

testWs.on('error', () => {
  console.error('❌ Line Wars server is not running on', SERVER_URL);
  console.log('💡 Please start the server with: npm run dev');
  process.exit(1);
});
