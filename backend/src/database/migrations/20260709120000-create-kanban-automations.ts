import { QueryInterface, DataTypes } from "sequelize";

// Automações do Kanban por coluna (tag). Cada linha é uma automação:
// - trigger: "on_enter" (ao mover o card para a coluna) | "idle" (parado X dias)
// - action: "message" | "template" | "webhook" | "move"
// - config: JSON com os parâmetros da ação (body, templateName, webhookUrl,
//   idleDays, targetTagId, etc.)

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.createTable("KanbanAutomations", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      tagId: {
        type: DataTypes.INTEGER,
        references: { model: "Tags", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      trigger: {
        type: DataTypes.STRING,
        allowNull: false
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false
      },
      config: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.dropTable("KanbanAutomations")
};
