import { QueryInterface, DataTypes } from "sequelize";

// Campos personalizados por ticket (card do Kanban), preenchidos via API.

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.createTable("TicketCustomFields", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      ticketId: {
        type: DataTypes.INTEGER,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
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
    queryInterface.dropTable("TicketCustomFields")
};
