/**
 * schema.ts - Zod 协议定义
 * 用 zod 定义页面协议，校验 schema，导出 TS 类型
 */
import { z } from 'zod'
import { applyPageControlRules } from './page-control'

export const GENERATED_NODE_ID_META_KEY = '__generatedNodeId'

// ========== Action Schema ==========

const RequestMethodSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value
    }

    return value.toLowerCase()
  },
  z.enum(['get', 'post', 'put', 'delete'])
)

const ExportSourceSchema = z.enum(['table', 'model', 'service'])
const ExportScopeSchema = z.enum(['current', 'all', 'fixed'])

export const ActionConfigSchema = z.object({
  type: z.enum([
    'state',
    'data',
    'request',
    'page',
    'modal',
    'save',
    'delete',
    'export',
    'import',
    'increment',
    'array',
  ]),
  key: z.string().optional(),
  path: z.string().optional(),
  use: z.string().optional(),
  pk: z.string().optional(),
  target: z.string().optional(),
  exportKey: z.string().optional(),
  importKey: z.string().optional(),
  tableId: z.string().optional(),
  source: ExportSourceSchema.optional(),
  scope: ExportScopeSchema.optional(),
  uploadRuleId: z.number().optional(),
  matchFields: z.array(z.string()).optional(),
  matchMode: z.string().optional(),
  value: z.any().optional(),
  op: z.string().optional(),
  index: z.any().optional(),
  api: z.string().optional(),
  method: RequestMethodSchema.optional(),
  data: z.any().optional(),
  params: z.any().optional(),
  filters: z.any().optional(),
  upsert: z.boolean().optional(),
  inheritRouteQuery: z.boolean().optional(),
  model: z.string().optional(),
  fileName: z.string().optional(),
  sheetName: z.string().optional(),
  templatePath: z.string().optional(),
  pageSize: z.number().optional(),
  fields: z.array(z.any()).optional(),
  workbook: z.record(z.string(), z.any()).optional(),
  styleDefs: z.record(z.string(), z.any()).optional(),
  before: z.any().optional(),
  after: z.any().optional(),
  then: z.any().optional(),
})

export const ActionMapSchema = z.record(z.string(), ActionConfigSchema)

const ItemActionValueSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.string(),
    ActionConfigSchema,
    z.array(z.union([z.string(), ActionConfigSchema])),
  ])
)

// ========== Item Schema ==========

export const ItemActionSchema = z.record(z.string(), ItemActionValueSchema)

export const OptionItemSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    value: z.string(),
  })
  .passthrough()

export const OptionConfigSchema = z
  .object({
    key: z.string().optional(),
    type: z.string().optional(),
    use: z.string().optional(),
    model: z.string().optional(),
    service: z.string().optional(),
    filters: z.record(z.string(), z.any()).optional(),
    searchFields: z.array(z.string()).optional(),
    extraFields: z.array(z.string()).optional(),
    valueField: z.string().optional(),
    labelField: z.string().optional(),
    parentField: z.string().optional(),
    leafField: z.string().optional(),
    order: z.string().optional(),
    pageSize: z.number().optional(),
    page: z.number().optional(),
    tree: z.boolean().optional(),
    rootValue: z.any().optional(),
  })
  .passthrough()

export const ValidateRuleSchema = z.object({
  type: z.string(),
  message: z.string().optional(),
  pattern: z.string().optional(),
  target: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  use: z.string().optional(),
  field: z.string().optional(),
  operator: z.string().optional(),
  except: z.string().optional(),
  params: z.any().optional(),
  when: z
    .array(
      z.object({
        path: z.string(),
        operator: z
          .enum([
            'equals',
            'notEquals',
            'empty',
            'notEmpty',
            'includes',
            'notIncludes',
          ])
          .optional(),
        value: z.any().optional(),
      })
    )
    .optional(),
  condition: z.enum(['all', 'any']).optional(),
})

export const ColumnSchema = z.object({
  name: z.string().optional(),
  auth: z.union([z.string(), z.array(z.string())]).optional(),
  tip: z.string().optional(),
  info: z.string().optional(),
  value: z.string().optional(),
  type: z.string().optional(),
  editor: z.union([z.boolean(), z.string()]).optional(),
  trigger: z.enum(['click', 'doubleClick']).optional(),
  action: ItemActionSchema.optional(),
  meta: z.record(z.string(), z.any()).optional(),
  className: z.string().optional(),
})

export const ItemSchema: z.ZodType<any> = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  auth: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  icon: z.string().optional(),
  tip: z.string().optional(),
  placeholder: z.string().optional(),
  info: z.string().optional(),
  value: z.string().optional(),
  option: z
    .union([z.array(OptionItemSchema), z.string(), OptionConfigSchema])
    .optional(),
  mode: z.enum(['form', 'table', 'search']).optional(),
  type: z.string(),
  meta: z.record(z.string(), z.any()).optional(),
  validate: z.array(ValidateRuleSchema).optional(),
  className: z.string().optional(),
  action: ItemActionSchema.optional(),
  items: z.array(z.any()).optional(),
})

// ========== Layout Schema ==========

export const LayoutNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.enum([
      'container',
      'header',
      'footer',
      'main',
      'aside',
      'row',
      'col',
      'card',
      'card-header',
      'card-content',
      'card-footer',
      'shell-sidebar-inset',
    ]),
    name: z.string().optional(),
    value: z.string().optional(),
    path: z.string().optional(),
    children: z.record(z.string(), LayoutNodeSchema).optional(),
    className: z.string().optional(),
    meta: z.record(z.string(), z.any()).optional(),
  })
)

export const LayoutSchema = LayoutNodeSchema

// ========== Page Schema ==========

export const PageInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  route: z.string().optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
  parent: z.string().optional(),
  sort: z.number().optional(),
  auth: z.array(z.any()).optional(),
  init: z.array(z.string()).optional(),
})

export const NodesSchema = z
  .record(z.string(), z.array(ItemSchema))
  .transform((nodes) => {
    return Object.fromEntries(
      Object.entries(nodes).map(([layoutId, items]) => [
        layoutId,
        items.map((item, index) => {
          if (item.id != null) {
            return item
          }

          return {
            ...item,
            id: `${layoutId}-${index}`,
            meta: {
              ...item.meta,
              [GENERATED_NODE_ID_META_KEY]: true,
            },
          }
        }),
      ])
    )
  })

export const PageSchema = z.object({
  page: PageInfoSchema,
  layout: LayoutSchema,
  nodes: NodesSchema.optional().default({}),
  data: z.record(z.string(), z.any()).optional().default({}),
  state: z.record(z.string(), z.any()).optional().default({}),
  action: ActionMapSchema.optional().default({}),
})

// ========== 类型导出 ==========

export type ActionConfig = z.infer<typeof ActionConfigSchema>
export type ActionMap = z.infer<typeof ActionMapSchema>
export type ItemAction = z.infer<typeof ItemActionSchema>
export type OptionItem = z.infer<typeof OptionItemSchema>
export type ValidateRule = z.infer<typeof ValidateRuleSchema>
export type Column = z.infer<typeof ColumnSchema>
export type Item = z.infer<typeof ItemSchema>
export type LayoutNode = z.infer<typeof LayoutNodeSchema>
export type Layout = z.infer<typeof LayoutSchema>
export type PageInfo = z.infer<typeof PageInfoSchema>
export type Nodes = z.infer<typeof NodesSchema>
export type PageSchemaType = z.infer<typeof PageSchema>

// ========== 校验函数 ==========

export function validatePageSchema(data: unknown): PageSchemaType {
  return applyPageControlRules(PageSchema.parse(data))
}
