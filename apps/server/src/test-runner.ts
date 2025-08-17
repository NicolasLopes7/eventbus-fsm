#!/usr/bin/env tsx

/**
 * Test runner for the EventBus FSM system
 * This can be run with: npx tsx src/test-runner.ts
 */

import { FSMOrchestrator } from './internal/flow';
import { FlowConfigParser } from './internal/flow-parser';
import { ReservationToolWorkers, SafeToolWorker } from './internal/tool-workers';
import { config } from './config';

async function testFSMSystem() {
  console.log('🧪 Testing EventBus FSM System\n');

  // Initialize orchestrator with mock classifier
  const orchestrator = new FSMOrchestrator(config.redisURL, undefined, true);

  // Create demo flow
  const flowConfig = FlowConfigParser.createReservationFlow();
  console.log('✅ Created reservation flow config');

  // Create session
  const sessionId = await orchestrator.getSessionManager().createSession(flowConfig);
  console.log(`✅ Created session: ${sessionId}`);

  // Register tools
  orchestrator.registerTool('CheckAvailability', new SafeToolWorker(
    ReservationToolWorkers.createCheckAvailabilityWorker()
  ));
  orchestrator.registerTool('CreateReservation', new SafeToolWorker(
    ReservationToolWorkers.createCreateReservationWorker()
  ));
  console.log('✅ Registered tool workers');

  // Subscribe to events for monitoring
  const subscriber = await orchestrator.getSessionManager().subscribeToSession(sessionId, (event) => {
    console.log(`📡 Event: ${event.type}`, JSON.stringify(event, null, 2));
  });

  try {
    // Start the flow
    await orchestrator.enterState(sessionId, flowConfig.start);
    console.log('✅ Started initial state');

    // Simulate conversation flow
    const conversations = [
      "I'd like to make a reservation",  // Should trigger BOOK intent -> CollectPartySize
      "We are 4 people",                // PROVIDE_PARTY_SIZE -> CollectReservationDateTime  
      "Tomorrow at 7pm",                // PROVIDE_DATETIME -> ConfirmAvailability
      // Tool will run CheckAvailability -> hopefully available -> CollectContactInformation
      "My name is John Doe, phone 555-1234" // PROVIDE_CONTACT -> CreateBooking
      // Tool will run CreateReservation -> Goodbye
    ];

    for (let i = 0; i < conversations.length; i++) {
      console.log(`\n👤 User: "${conversations[i]}"`);
      await orchestrator.processUserInput(sessionId, conversations[i]);

      // Wait a bit for events to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check current state
      const session = await orchestrator.getSessionManager().getSessionState(sessionId);
      console.log(`🎯 Current state: ${session?.currentState}`);
      console.log(`📝 Context:`, JSON.stringify(session?.context, null, 2));
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await subscriber.quit();
    await orchestrator.getSessionManager().cleanupSession(sessionId);
    console.log('🧹 Cleaned up test session');
  }
}

async function testClassifier() {
  console.log('\n🧪 Testing Mock Classifier\n');

  const orchestrator = new FSMOrchestrator(config.redisURL, undefined, true);
  const classifier = orchestrator.getClassifier();

  const intents = {
    BOOK: {
      examples: ["I'd like to book", "reservation", "table for two"],
      slots: {}
    },
    PROVIDE_PARTY_SIZE: {
      examples: ["we are 6", "party of 10"],
      slots: { partySize: "number" }
    },
    PROVIDE_DATETIME: {
      examples: ["tomorrow at 7pm", "Aug 20th 19:30"],
      slots: { date: "date", time: "time" }
    }
  };

  const testCases = [
    "I want to make a reservation",
    "Table for 4 people please",
    "We are a party of 8",
    "Tomorrow at 7:30pm",
    "Next Friday at 6pm"
  ];

  for (const testCase of testCases) {
    try {
      const result = await classifier.classifyIntent(testCase, intents);
      console.log(`Input: "${testCase}"`);
      console.log(`Result:`, JSON.stringify(result, null, 2));
      console.log('---');
    } catch (error) {
      console.error(`Failed to classify "${testCase}":`, error);
    }
  }
}

async function testFlowConfig() {
  console.log('\n🧪 Testing Flow Config Parser\n');

  try {
    const flowConfig = FlowConfigParser.createReservationFlow();
    console.log('✅ Created default reservation flow');

    FlowConfigParser.validate(flowConfig);
    console.log('✅ Flow config validation passed');

    console.log(`Flow: ${flowConfig.meta.name}`);
    console.log(`Start state: ${flowConfig.start}`);
    console.log(`States: ${Object.keys(flowConfig.states).join(', ')}`);
    console.log(`Intents: ${Object.keys(flowConfig.intents).join(', ')}`);
    console.log(`Tools: ${Object.keys(flowConfig.tools).join(', ')}`);

  } catch (error) {
    console.error('❌ Flow config test failed:', error);
  }
}

// Main test runner
async function main() {
  console.log('🚀 EventBus FSM Test Suite\n');

  try {
    // Test individual components
    await testFlowConfig();

    // Test mock classifier
    await testClassifier();

    // Test full system
    await testFSMSystem();

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
