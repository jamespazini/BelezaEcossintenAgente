'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('conversation_sessions').catch(() => null);
    if (!tableDesc) {
      await queryInterface.createTable('conversation_sessions', {
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
        customer_number: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        whatsapp_number: {
          type: Sequelize.STRING(32),
          allowNull: false,
        },
        conversation_state: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'NEW',
        },
        session_context: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        last_interaction_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
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
      await queryInterface.addConstraint('conversation_sessions', {
        type: 'unique',
        fields: ['tenant_id', 'whatsapp_number', 'customer_number'],
        name: 'conversation_sessions_tenant_whatsapp_customer_unique',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conversation_sessions');
  },
};
