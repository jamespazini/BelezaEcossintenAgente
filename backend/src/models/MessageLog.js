const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('MessageLog', {
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
    session_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'conversation_sessions', key: 'id' },
    },
    whatsapp_number: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM('INBOUND', 'OUTBOUND'),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    provider_message_id: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    event_type: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'message_logs',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });
};
