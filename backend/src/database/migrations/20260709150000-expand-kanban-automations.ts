import { QueryInterface, DataTypes } from "sequelize";

// Expande as automações do Kanban para o modelo avançado (multi-gatilho /
// multi-ação, com nome, descrição, intervalo, horário e execução retroativa).
// As colunas legadas (trigger/action/config) permanecem para compatibilidade.

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.addColumn("KanbanAutomations", "name", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("KanbanAutomations", "description", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("KanbanAutomations", "triggers", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("KanbanAutomations", "actions", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("KanbanAutomations", "settings", {
        type: DataTypes.TEXT,
        allowNull: true
      })
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.removeColumn("KanbanAutomations", "name"),
      queryInterface.removeColumn("KanbanAutomations", "description"),
      queryInterface.removeColumn("KanbanAutomations", "triggers"),
      queryInterface.removeColumn("KanbanAutomations", "actions"),
      queryInterface.removeColumn("KanbanAutomations", "settings")
    ]);
  }
};
