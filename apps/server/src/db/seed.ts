import { db } from './connection';
import { users, flows, flowCategories, flowCategoryMappings } from './schema';
import { FlowConfigParser } from '../internal/flow-parser';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create a default user
    const [defaultUser] = await db.insert(users).values({
      name: 'System Admin',
      email: 'admin@eventbus-fsm.com',
    }).returning();

    console.log('✅ Created default user:', defaultUser.email);

    // Create flow categories
    const [restaurantCategory] = await db.insert(flowCategories).values({
      name: 'Restaurant',
      description: 'Restaurant and hospitality flows',
      color: '#3B82F6', // blue
    }).returning();

    const [customerServiceCategory] = await db.insert(flowCategories).values({
      name: 'Customer Service',
      description: 'General customer service flows',
      color: '#10B981', // green
    }).returning();

    console.log('✅ Created flow categories');

    // Create the default reservation flow from our existing parser
    const reservationFlowConfig = FlowConfigParser.createReservationFlow();

    const [reservationFlow] = await db.insert(flows).values({
      name: 'Bella Vista Reservations',
      description: 'Complete restaurant reservation flow with party size handling, date/time collection, and booking confirmation',
      status: 'published',
      definition: reservationFlowConfig,
      createdBy: defaultUser.id,
      publishedAt: new Date(),
      usageCount: 0,
    }).returning();

    console.log('✅ Created reservation flow:', reservationFlow.name);

    // Link the reservation flow to the restaurant category
    await db.insert(flowCategoryMappings).values({
      flowId: reservationFlow.id,
      categoryId: restaurantCategory.id,
    });

    // Create a simple customer service flow
    const customerServiceFlow = {
      meta: {
        name: 'Customer Service Bot',
        language: 'en',
        voice: 'alloy',
      },
      start: 'Greeting',
      states: {
        Greeting: {
          onEnter: [{ say: 'Hello! How can I help you today?' }],
          transitions: [
            { onIntent: ['COMPLAINT'], to: 'HandleComplaint' },
            { onIntent: ['QUESTION'], to: 'AnswerQuestion' },
            { onIntent: ['TRANSFER'], to: 'TransferToAgent' },
          ],
        },
        HandleComplaint: {
          onEnter: [{ ask: 'I understand you have a concern. Can you please describe the issue?' }],
          transitions: [
            { onIntent: ['PROVIDE_DETAILS'], to: 'ProcessComplaint' },
          ],
        },
        AnswerQuestion: {
          onEnter: [{ ask: 'What would you like to know?' }],
          transitions: [
            { onIntent: ['PROVIDE_QUESTION'], to: 'ProvideAnswer' },
          ],
        },
        ProcessComplaint: {
          onEnter: [{ say: 'Thank you for the details. I\'ve logged your complaint and someone will follow up within 24 hours.' }],
          transitions: [],
        },
        ProvideAnswer: {
          onEnter: [{ say: 'Based on your question, here\'s what I can help with...' }],
          transitions: [],
        },
        TransferToAgent: {
          onEnter: [{ say: 'Let me connect you with a human agent.' }],
          transitions: [],
        },
      },
      intents: {
        COMPLAINT: {
          examples: ['I have a complaint', 'I\'m not satisfied', 'There\'s a problem'],
          slots: {},
        },
        QUESTION: {
          examples: ['I have a question', 'Can you help me', 'I need information'],
          slots: {},
        },
        TRANSFER: {
          examples: ['Transfer to agent', 'Speak to human', 'Connect me to someone'],
          slots: {},
        },
        PROVIDE_DETAILS: {
          examples: ['Here are the details', 'Let me explain', 'The issue is'],
          slots: {},
        },
        PROVIDE_QUESTION: {
          examples: ['My question is', 'I want to know', 'Can you tell me'],
          slots: {},
        },
      },
      tools: {},
    };

    const [csFlow] = await db.insert(flows).values({
      name: 'Customer Service Bot',
      description: 'General customer service flow for handling complaints, questions, and transfers',
      status: 'published',
      definition: customerServiceFlow,
      createdBy: defaultUser.id,
      publishedAt: new Date(),
      usageCount: 0,
    }).returning();

    console.log('✅ Created customer service flow:', csFlow.name);

    // Link to customer service category
    await db.insert(flowCategoryMappings).values({
      flowId: csFlow.id,
      categoryId: customerServiceCategory.id,
    });

    console.log('🎉 Database seeded successfully!');
    console.log(`
📊 Summary:
- Users: 1
- Flow Categories: 2
- Flows: 2
- Category Mappings: 2

🚀 You can now:
- View flows in Drizzle Studio: pnpm db:studio
- Use the flows in your application
- Create new flows via the API
    `);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seed function
seed().then(() => {
  console.log('✅ Seeding completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
