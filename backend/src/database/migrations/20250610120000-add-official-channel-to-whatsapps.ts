import { QueryInterface, DataTypes } from "sequelize";

// Adiciona suporte ao canal oficial do WhatsApp (Meta Cloud API)
// na tabela Whatsapps, mantendo o Baileys como canal padrão.

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.addColumn("Whatsapps", "channel", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "baileys"
      }),
      queryInterface.addColumn("Whatsapps", "officialWabaId", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "officialPhoneNumberId", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "officialAccessToken", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "officialVerifyToken", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "officialApiVersion", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "v21.0"
      })
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.removeColumn("Whatsapps", "channel"),
      queryInterface.removeColumn("Whatsapps", "officialWabaId"),
      queryInterface.removeColumn("Whatsapps", "officialPhoneNumberId"),
      queryInterface.removeColumn("Whatsapps", "officialAccessToken"),
      queryInterface.removeColumn("Whatsapps", "officialVerifyToken"),
      queryInterface.removeColumn("Whatsapps", "officialApiVersion")
    ]);
  }
};
