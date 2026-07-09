import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  ForeignKey,
  BelongsTo,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Tag from "./Tag";

@Table({ tableName: "KanbanAutomations" })
class KanbanAutomation extends Model<KanbanAutomation> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  // Coluna do Kanban à qual a automação pertence.
  @ForeignKey(() => Tag)
  @Column
  tagId: number;

  @BelongsTo(() => Tag)
  tag: Tag;

  @Column
  name: string;

  @Column(DataType.TEXT)
  description: string;

  // JSON: array de gatilhos [{ type, ...config }]
  @Column(DataType.TEXT)
  triggers: string;

  // JSON: array de ações [{ type, ...config }] (executadas em ordem)
  @Column(DataType.TEXT)
  actions: string;

  // JSON: { intervalSeconds, respectBusinessHours, retroactive }
  @Column(DataType.TEXT)
  settings: string;

  // ---- Legado (compatibilidade com automações simples) ----
  // "on_enter" | "idle"
  @Column(DataType.STRING)
  trigger: string;

  // "message" | "template" | "webhook" | "move"
  @Column(DataType.STRING)
  action: string;

  // JSON com parâmetros da ação (body, templateName, languageCode, webhookUrl,
  // idleDays, targetTagId, ...)
  @Column(DataType.TEXT)
  config: string;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default KanbanAutomation;
