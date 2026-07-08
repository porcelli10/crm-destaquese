import { QueryInterface, DataTypes } from "sequelize";

// Adiciona suporte ao canal iaSolution Hub (wrapper da WhatsApp Cloud API)
// na tabela Whatsapps. Usado quando channel === "iasolution".
// A conexão é baseada apenas no token do canal (Bearer); o número é conectado
// no painel do iaSolution.

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Whatsapps", "iasolutionToken", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "iasolutionToken");
  }
};
