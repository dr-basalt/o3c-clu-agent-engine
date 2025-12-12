import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 12);
  const apiKey = randomBytes(32).toString('hex');
  const workspaceId = `ws_${randomBytes(8).toString('hex')}`;

  const user = await prisma.user.upsert({
    where: { email: 'demo@o3c.dev' },
    update: {},
    create: {
      email: 'demo@o3c.dev',
      passwordHash: hashedPassword,
      name: 'Demo User',
      workspaceId,
      apiKey,
      isActive: true,
    },
  });

  console.log('✅ Created demo user:', {
    email: user.email,
    apiKey: user.apiKey,
    workspaceId: user.workspaceId,
  });

  // Create test provider config (OpenAI)
  const providerConfig = await prisma.providerConfig.create({
    data: {
      userId: user.id,
      providerName: 'openai',
      flavor: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      isDefault: true,
      defaultModel: 'gpt-4',
      headers: {},
    },
  });

  console.log('✅ Created provider config:', providerConfig.providerName);

  // Create test agent
  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Demo Agent',
      description: 'A demo agent for testing',
      systemPrompt: 'You are a helpful AI assistant.',
      mcpServers: [],
      tools: ['shell'],
      isActive: true,
      allowShell: true,
      maxIterations: 10,
      metadata: { demo: true },
    },
  });

  console.log('✅ Created agent:', agent.name);

  // Create additional test agents
  const emailAgent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Email Manager',
      description: 'Agent for managing emails',
      systemPrompt: 'You are an email management assistant. Help users organize, read, and respond to emails.',
      mcpServers: [],
      tools: ['email'],
      isActive: true,
      allowShell: false,
      maxIterations: 5,
      metadata: { category: 'productivity' },
    },
  });

  const dataAgent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Data Analyzer',
      description: 'Agent for data analysis and reporting',
      systemPrompt: 'You are a data analysis expert. Analyze datasets and provide insights.',
      mcpServers: [],
      tools: ['python', 'pandas'],
      isActive: true,
      allowShell: true,
      maxIterations: 20,
      metadata: { category: 'analytics' },
    },
  });

  console.log('✅ Created additional agents');

  // Create test workflow
  const workflow = await prisma.workflow.create({
    data: {
      userId: user.id,
      name: 'Email Processing Pipeline',
      description: 'Process incoming emails and analyze sentiment',
      isActive: true,
      metadata: { category: 'automation' },
      steps: {
        create: [
          {
            agentId: emailAgent.id,
            order: 0,
            inputMapping: {},
            metadata: { stepName: 'Read Emails' },
          },
          {
            agentId: dataAgent.id,
            order: 1,
            inputMapping: { emails: 'output' },
            metadata: { stepName: 'Analyze Sentiment' },
          },
        ],
      },
    },
  });

  console.log('✅ Created workflow:', workflow.name);

  // Create additional test users
  const testUsers = [
    {
      email: 'alice@o3c.dev',
      name: 'Alice Test',
      password: 'alice123',
    },
    {
      email: 'bob@o3c.dev',
      name: 'Bob Test',
      password: 'bob123',
    },
  ];

  for (const testUser of testUsers) {
    const hashedPwd = await bcrypt.hash(testUser.password, 12);
    const testApiKey = randomBytes(32).toString('hex');
    const testWorkspaceId = `ws_${randomBytes(8).toString('hex')}`;

    const createdUser = await prisma.user.upsert({
      where: { email: testUser.email },
      update: {},
      create: {
        email: testUser.email,
        passwordHash: hashedPwd,
        name: testUser.name,
        workspaceId: testWorkspaceId,
        apiKey: testApiKey,
        isActive: true,
      },
    });

    console.log(`✅ Created test user: ${createdUser.email} (password: ${testUser.password})`);
  }

  console.log('\n🎉 Database seeding completed!\n');
  console.log('📝 Test credentials:');
  console.log('\n=== Main Demo Account ===');
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: password123`);
  console.log(`   API Key: ${user.apiKey}`);
  console.log(`   Workspace: ${user.workspaceId}`);
  console.log('\n=== Additional Test Accounts ===');
  console.log('   alice@o3c.dev / alice123');
  console.log('   bob@o3c.dev / bob123');
  console.log('\n=== Test Data ===');
  console.log(`   Agents: ${emailAgent.name}, ${dataAgent.name}, ${agent.name}`);
  console.log(`   Workflows: ${workflow.name}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
