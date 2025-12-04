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

  console.log('\n🎉 Database seeding completed!\n');
  console.log('📝 Test credentials:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: password123`);
  console.log(`   API Key: ${user.apiKey}`);
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
