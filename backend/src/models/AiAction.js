const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('AiAction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'conversation_sessions', key: 'id' },
    },
    appointment_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'appointments', key: 'id' },
    },
    action_type: {
      type: DataTypes.ENUM('CONFIRM_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'BUSINESS_HOURS', 'SERVICES', 'PRICES', 'HUMAN_SUPPORT', 'ESCALATE_HUMAN'),
      allowNull: false,
    },
    action_payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'ai_actions',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });
};
