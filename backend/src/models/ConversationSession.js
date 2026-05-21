const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ConversationSession', {
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
    customer_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'clients', key: 'id' },
    },
    customer_number: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    whatsapp_number: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    conversation_state: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'NEW',
    },
    session_context: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    last_interaction_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'conversation_sessions',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });
};
