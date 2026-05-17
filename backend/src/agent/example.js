/**
 * Agent Integration Example
 * Test script to demonstrate agent functionality
 * 
 * Usage: node backend/src/agent/example.js
 */

require('dotenv').config({ path: '../../.env' });
const agentService = require('./agent.service');

/**
 * Example function to test the agent
 */
async function testAgent() {
  console.log('\n🧠 Testing Beleza Ecosystem Intelligent Agent\n');
  console.log('================================================\n');

  try {
    // 1. Test OpenAI Connection
    console.log('1️⃣  Testing OpenAI Connection...');
    const isConnected = await agentService.testConnection();
    
    if (!isConnected) {
      console.error('❌ OpenAI connection failed. Check your OPENAI_API_KEY.');
      process.exit(1);
    }
    console.log('✅ OpenAI Connection successful!\n');

    // 2. Simulated Establishment Data
    const establishmentData = {
      name: 'Salão de Beleza Central',
      totalClients: 250,
      monthlyRevenue: 15000,
      appointmentsThisMonth: 95,
      averageTicket: 157.89,
      activeServices: 12,
      inactiveClients: 35
    };

    console.log('2️⃣  Establishment Context:');
    console.log(`   📍 ${establishmentData.name}`);
    console.log(`   👥 ${establishmentData.totalClients} clients`);
    console.log(`   💰 R$ ${establishmentData.monthlyRevenue}/month\n`);

    // 3. Send Test Message
    const testMessage = 'Como faço para aumentar meu faturamento em 20%?';
    
    console.log(`3️⃣  Sending message: "${testMessage}"\n`);
    console.log('Waiting for agent response...\n');

    const result = await agentService.processMessage(
      testMessage,
      'test-establishment-123',
      establishmentData
    );

    // 4. Display Response
    console.log('4️⃣  Agent Response:\n');
    console.log(result.response);
    console.log('\n================================================\n');

    // 5. Display Actions
    if (result.actions.length > 0) {
      console.log(`5️⃣  Actions Detected: ${result.actions.length}\n`);
      result.actions.forEach((action, idx) => {
        console.log(`   ${idx + 1}. [${action.name}]`);
        console.log(`      Params: ${JSON.stringify(action.params, null, 2)}`);
      });
    } else {
      console.log('5️⃣  No Actions Detected');
    }

    // 6. Metadata
    console.log('\n6️⃣  Metadata:');
    console.log(`   🤖 Model: ${result.metadata.model}`);
    console.log(`   📊 Tokens Used: ${result.metadata.tokensUsed}`);
    console.log(`   ⏱️  Timestamp: ${result.metadata.timestamp}`);

    console.log('\n================================================');
    console.log('✅ Agent Test Completed Successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run test
testAgent().catch(console.error);
