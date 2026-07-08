import { QueryInterface, DataTypes } from "sequelize";

// Adiciona suporte ao canal Hub NotificaMe (WhatsApp, Facebook e Instagram
// via API unificada do NotificaMe Hub) na tabela Whatsapps.
// Usado quando channel === "hub".

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await Promise.all([
      // Token da conta/canal no NotificaMe Hub
      queryInterface.addColumn("Whatsapps", "hubToken", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      // Tipo do canal no Hub: "whatsapp" | "facebook" | "instagram"
      queryInterface.addColumn("Whatsapps", "hubChannel", {
        type: DataTypes.STRING,
        allowNull: true
      }),
      // Identificador do remetente (o "from" enviado à API do Hub e o "to"
      // recebido nas mensagens de entrada)
      queryInterface.addColumn("Whatsapps", "hubFrom", {
        type: DataTypes.STRING,
        allowNull: true
      })
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.removeColumn("Whatsapps", "hubToken"),
      queryInterface.removeColumn("Whatsapps", "hubChannel"),
      queryInterface.removeColumn("Whatsapps", "hubFrom")
    ]);
  }
};
