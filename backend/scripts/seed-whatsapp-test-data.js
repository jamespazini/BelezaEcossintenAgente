'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sequelize, User, Tenant, Establishment, Professional, Client, SubscriptionPlan, Subscription } = require('../src/models');

async function main() {
  await sequelize.authenticate();
  const passwordHash = await bcrypt.hash('123456', 10);
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + 14);

  const tenant = await Tenant.upsert({
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Salão Beleza Pura',
    slug: 'beleza-pura',
    email: 'contato@belezapura.com',
    phone: '11987654321',
    document_type: 'cnpj',
    document: '12345678000190',
    type: 'establishment',
    status: 'active',
    address: {
      street: 'Rua das Flores',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234567',
      country: 'BR',
    },
    settings: {
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
      language: 'pt-BR',
      notificationsEnabled: true,
      allowOnlineBooking: true,
    },
    branding: {
      primaryColor: '#603322',
      secondaryColor: '#F8E6C2',
    },
    activated_at: now,
  }, { returning: true });

  const savedTenant = Array.isArray(tenant) ? tenant[0] : tenant;

  const owner = await User.upsert({
    id: '00000000-0000-0000-0000-000000000101',
    email: 'owner@belezapura.com',
    password: passwordHash,
    role: 'owner',
    tenant_id: savedTenant.id,
    first_name: 'Maria',
    last_name: 'Silva',
    phone: '11987654321',
    is_active: true,
  }, { returning: true });

  const ownerUser = Array.isArray(owner) ? owner[0] : owner;

  const admin = await User.upsert({
    id: '00000000-0000-0000-0000-000000000102',
    email: 'admin@belezapura.com',
    password: passwordHash,
    role: 'admin',
    tenant_id: savedTenant.id,
    first_name: 'João',
    last_name: 'Admin',
    phone: '11912345678',
    is_active: true,
  }, { returning: true });

  const adminUser = Array.isArray(admin) ? admin[0] : admin;

  const prof1 = await User.upsert({
    id: '00000000-0000-0000-0000-000000000103',
    email: 'prof@belezapura.com',
    password: passwordHash,
    role: 'professional',
    tenant_id: savedTenant.id,
    first_name: 'Ana',
    last_name: 'Profissional',
    phone: '11998765432',
    is_active: true,
  }, { returning: true });

  const prof1User = Array.isArray(prof1) ? prof1[0] : prof1;

  const prof2 = await User.upsert({
    id: '00000000-0000-0000-0000-000000000104',
    email: 'carlos@belezapura.com',
    password: passwordHash,
    role: 'professional',
    tenant_id: savedTenant.id,
    first_name: 'Carlos',
    last_name: 'Santos',
    phone: '11933334444',
    is_active: true,
  }, { returning: true });

  const prof2User = Array.isArray(prof2) ? prof2[0] : prof2;

  const establishment = await Establishment.upsert({
    id: '00000000-0000-0000-0000-000000000201',
    user_id: ownerUser.id,
    name: 'Salão Beleza Pura',
    address: 'Rua das Flores, 123 - Centro, São Paulo/SP',
    phone: '11987654321',
    email: 'contato@belezapura.com',
    cnpj: '12345678000190',
  }, { returning: true });

  const savedEstablishment = Array.isArray(establishment) ? establishment[0] : establishment;

  await Tenant.update({ owner_id: ownerUser.id }, { where: { id: savedTenant.id } });

  await Professional.upsert({
    id: '00000000-0000-0000-0000-000000000301',
    user_id: prof1User.id,
    establishment_id: savedEstablishment.id,
    tenant_id: savedTenant.id,
    specialty: 'Extensão de Cílios',
    commission_rate: 40.00,
  });

  await Professional.upsert({
    id: '00000000-0000-0000-0000-000000000302',
    user_id: prof2User.id,
    establishment_id: savedEstablishment.id,
    tenant_id: savedTenant.id,
    specialty: 'Cabeleireiro',
    commission_rate: 35.00,
  });

  const clientRows = [
    ['Thaisa', 'Oliveira', 'thaisa@email.com', '11988881111'],
    ['Rafaela', 'Costa', 'rafaela@email.com', '11988882222'],
    ['Taís', 'Mendes', 'tais@email.com', '11988883333'],
    ['Juliana', 'Ferreira', 'juliana@email.com', '11988884444'],
    ['Camila', 'Souza', 'camila@email.com', '11988885555'],
  ];

  for (const [first_name, last_name, email, phone] of clientRows) {
    await Client.upsert({
      id: uuidv4(),
      establishment_id: savedEstablishment.id,
      first_name,
      last_name,
      email,
      phone,
    });
  }

  const plan = await SubscriptionPlan.findOne({ where: { slug: 'professional' } });
  if (!plan) {
    throw new Error('SubscriptionPlan professional não encontrado');
  }

  await Subscription.upsert({
    id: '00000000-0000-0000-0000-000000000401',
    tenant_id: savedTenant.id,
    plan_id: plan.id,
    status: 'trial',
    started_at: now,
    trial_ends_at: trialEnds,
    quantity: 1,
    plan_snapshot: {
      name: plan.name,
      price: plan.price,
      limits: plan.limits,
    },
    metadata: {},
  });

  console.log(JSON.stringify({
    tenant: savedTenant.slug,
    owner: ownerUser.email,
    admin: adminUser.email,
    professional1: prof1User.email,
    professional2: prof2User.email,
    establishment: savedEstablishment.id,
    clients: clientRows.length,
    subscription: 'trial',
  }, null, 2));

  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  if (sequelize) {
    await sequelize.close();
  }
  process.exitCode = 1;
});
