import { QueryInterface, DataTypes } from "sequelize";

// Ordem das colunas do Kanban (posição da tag no pipeline).

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tags", "position", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tags", "position");
  }
};
