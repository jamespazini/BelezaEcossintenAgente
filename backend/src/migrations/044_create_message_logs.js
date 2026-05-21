'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('message_logs').catch(() => null);
    if (!tableDesc) {
      await queryInterface.createTable('message_logs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
          allowNull: false,
          primaryKey: true,
        },
        tenant_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'tenants', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        customer_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'clients', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        session_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'conversation_sessions', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        whatsapp_number: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        direction: {
          type: Sequelize.ENUM('INBOUND', 'OUTBOUND'),
          allowNull: false,
        },
        body: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        status: {
          type: Sequelize.STRING(32),
          allowNull: true,
        },
        provider_message_id: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        event_type: {
          type: Sequelize.STRING(80),
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW'),
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('message_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_message_logs_direction";');
  },
};
