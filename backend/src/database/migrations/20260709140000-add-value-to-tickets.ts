import { QueryInterface, DataTypes } from "sequelize";

// Valor do negócio (R$) exibido no card do Kanban e somado por coluna.

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "value", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "value");
  }
};
