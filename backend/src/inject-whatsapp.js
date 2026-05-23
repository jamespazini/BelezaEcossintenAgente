require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./models');

async function injectConversation() {
  try {
    const tenant = await db.Tenant.findOne({ where: { slug: 'beleza-pura' } });
    if (!tenant) throw new Error('Tenant não encontrado');

    const customerNumber = 'whatsapp:+5514996308553';
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    const [session] = await db.ConversationSession.findOrCreate({
      where: {
        tenant_id: tenant.id,
        customer_number: customerNumber,
      },
      defaults: {
        whatsapp_number: whatsappNumber,
        conversation_state: 'ACTIVE',
        session_context: { last_message: 'Mensagem inicial de teste' },
      }
    });

    await db.MessageLog.create({
      tenant_id: tenant.id,
      session_id: session.id,
      customer_id: null,
      whatsapp_number: whatsappNumber,
      direction: 'INBOUND',
      body: 'Olá, testando o painel pelo meu celular!',
      status: 'received',
      event_type: 'webhook_inbound',
    });

    console.log('✅ Conversa teste injetada com sucesso! Você já pode ver no painel.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

injectConversation();
