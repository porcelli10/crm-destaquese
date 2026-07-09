import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";
import Ticket from "./Ticket";
import Company from "./Company";

// Campos personalizados exibidos no card do Kanban. Preenchidos via API externa
// (POST /api/kanban/custom-fields) por sistemas de terceiros (n8n, IA, etc.).
@Table({ tableName: "TicketCustomFields" })
class TicketCustomField extends Model<TicketCustomField> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column(DataType.TEXT)
  value: string;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TicketCustomField;
