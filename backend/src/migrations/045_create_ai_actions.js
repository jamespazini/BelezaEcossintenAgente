'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('ai_actions').catch(() => null);
    if (!tableDesc) {
      await queryInterface.createTable('ai_actions', {
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
        session_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'conversation_sessions', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        appointment_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'appointments', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        action_type: {
          type: Sequelize.ENUM('CONFIRM_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'BUSINESS_HOURS', 'SERVICES', 'PRICES', 'HUMAN_SUPPORT', 'ESCALATE_HUMAN'),
          allowNull: false,
        },
        action_payload: {
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
    await queryInterface.dropTable('ai_actions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_actions_action_type";');
  },
};
