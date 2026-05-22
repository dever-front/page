import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from 'react'
import {
  Check,
  GripVertical,
  Loader2,
  Maximize2,
  Network,
  Plus,
  Save,
  SquarePen,
  Trash2,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { request } from '@/lib/request'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { AssistantContextFormFillButton } from '@/components/assistant/form-actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SearchableOptionPicker } from '@/components/searchable-option-picker'
import type {
  AssistantFieldContext,
  AssistantPageContext,
} from '@/lib/assistant/context'
import type { NodeItemProps } from '../../nodes'

type ThinkItem = {
  id?: number
  key: string
  name: string
  type?: string
  goal?: string
  config?: Record<string, any>
  position?: Record<string, any>
  status?: number
  sort?: number
}

type ThinkEdge = {
  id?: number
  from_key: string
  to_key: string
  condition?: string
  input_mapping?: Record<string, any>
  status?: number
  sort?: number
}

type BrainNode = {
  id?: number
  node_key: string
  name: string
  type: string
  agent_id?: number
  config?: Record<string, any>
  position?: Record<string, any>
  status?: number
  sort?: number
}

type NodeEdge = {
  id?: number
  from_key: string
  to_key: string
  condition?: string
  input_mapping?: Record<string, any>
  status?: number
  sort?: number
}

type ThinkCreatePower = {
  id?: number
  kind: string
  power_id?: number
  power_ids?: number[]
  status?: number
  sort?: number
}

type AgentOption = {
  id: number
  cate_id?: number
  name: string
  key: string
}

type PowerOption = {
  id: number
  cate_id?: number
  name: string
  key: string
  kind: string
}

type PowerKindOption = {
  id: string
  value: string
}

type AgentCateOption = {
  id: number
  value?: string
  name?: string
}

type WorkspaceData = {
  brain?: Record<string, any>
  thinks?: ThinkItem[]
  think_edges?: ThinkEdge[]
  flow_nodes_by_think?: Record<string, BrainNode[]>
  flow_edges_by_think?: Record<string, NodeEdge[]>
  nodes_by_think?: Record<string, BrainNode[]>
  edges_by_think?: Record<string, NodeEdge[]>
  create_powers_by_think?: Record<string, ThinkCreatePower[]>
  agents?: AgentOption[]
  agent_cates?: AgentCateOption[]
  powers?: PowerOption[]
  power_kinds?: PowerKindOption[]
  node_types?: Array<{ id: string; value: string }>
  edge_conditions?: Array<{ id: string; value: string }>
}

type Selection =
  | { kind: 'think'; key: string }
  | { kind: 'think_edge'; index: number }
  | { kind: 'node'; key: string }
  | { kind: 'node_edge'; index: number }
  | null

type ConnectState = {
  kind: 'think' | 'node'
  fromKey: string
} | null

type ContextMenuState = {
  x: number
  y: number
  target: Exclude<Selection, null>
} | null

type CanvasPoint = {
  x: number
  y: number
}

type CanvasPanState = {
  x: number
  y: number
  scrollLeft: number
  scrollTop: number
} | null

type ViewMode = 'think' | 'node' | 'create'

const NODE_TYPES = [
  { id: 'agent', value: '智能体' },
  { id: 'power', value: '能力' },
  { id: 'condition', value: '条件' },
  { id: 'merge', value: '合并' },
  { id: 'human_approval', value: '人工确认' },
  { id: 'save', value: '保存' },
]
const VISIBLE_NODE_TYPE_IDS = new Set(NODE_TYPES.map((item) => item.id))

const EDGE_CONDITIONS = [
  { id: 'always', value: '总是' },
  { id: 'completed', value: '完成' },
  { id: 'passed', value: '通过' },
  { id: 'failed', value: '不通过' },
  { id: 'approved', value: '确认' },
  { id: 'rejected', value: '驳回' },
]

const CONDITION_OPERATORS = [
  { id: 'exists', value: '有内容' },
  { id: 'contains', value: '包含' },
  { id: 'equals', value: '等于' },
  { id: 'truthy', value: '为真' },
  { id: 'falsy', value: '为假' },
]

const CARD_WIDTH = 192
const CARD_HEIGHT = 116
const CANVAS_WIDTH = 2200
const CANVAS_HEIGHT = 1400
const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.8
const ZOOM_STEP = 0.12
const THINK_TYPE_FLOW = 'flow'
const THINK_TYPE_CREATE = 'create'
const BRAIN_PUBLISH_DRAFT = 'draft'
const BRAIN_PUBLISH_PUBLISHED = 'published'
const BRAIN_PUBLISH_EDITING = 'editing'
const THINK_TYPES = [
  { id: THINK_TYPE_FLOW, value: '流程' },
  { id: THINK_TYPE_CREATE, value: '创作' },
]
const THINK_ASSISTANT_FIELDS: AssistantFieldContext[] = [
  {
    path: 'form.name',
    name: '名称',
    type: 'form-input',
  },
  {
    path: 'form.type',
    name: '思维类型',
    type: 'form-select',
    options: THINK_TYPES,
  },
  {
    path: 'form.goal',
    name: '目标',
    type: 'form-textarea',
  },
]

export function ShowBrainWorkspace({ item }: NodeItemProps) {
  const meta = item.meta ?? {}
  const brainID = useMemo(() => resolveBrainID(), [])
  const [workspace, setWorkspace] = useState<WorkspaceData>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ViewMode>('think')
  const [selectedThinkKey, setSelectedThinkKey] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [connect, setConnect] = useState<ConnectState>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Selection>(null)
  const [dragThinkKey, setDragThinkKey] = useState('')

  const workspaceApi = String(meta.workspaceApi || '/bot/brain/workspace_data')
  const saveThinkApi = String(meta.saveThinkApi || '/bot/brain/save_think_graph')
  const saveNodeApi = String(meta.saveFlowApi || meta.saveNodeApi || '/bot/brain/save_flow_graph')
  const saveCreateApi = String(meta.saveCreateApi || '/bot/brain/save_create_config')

  const publishStatus = normalizeBrainPublishStatus(workspace.brain?.publish_status)
  const readonly = isBrainReadonly(workspace.brain)
  const thinks = workspace.thinks ?? []
  const thinkEdges = workspace.think_edges ?? []
  const activeThink = thinks.find((think) => think.key === selectedThinkKey)
  const activeNodes = selectedThinkKey
    ? workspace.nodes_by_think?.[selectedThinkKey] ?? []
    : []
  const activeNodeEdges = selectedThinkKey
    ? workspace.edges_by_think?.[selectedThinkKey] ?? []
    : []
  const activeCreatePowers = selectedThinkKey
    ? workspace.create_powers_by_think?.[selectedThinkKey] ?? []
    : []
  const agents = workspace.agents ?? []
  const agentCates = workspace.agent_cates ?? []
  const powers = workspace.powers ?? []
  const powerKinds = workspace.power_kinds ?? []
  const nodeTypes = visibleNodeTypes(
    workspace.node_types?.length ? workspace.node_types : NODE_TYPES
  )
  const edgeConditions = workspace.edge_conditions?.length
    ? workspace.edge_conditions
    : EDGE_CONDITIONS

  const applyWorkspaceData = useCallback((data: any) => {
    const next = normalizeWorkspace(data)
    setWorkspace(next)
    setSelectedThinkKey((current) =>
      next.thinks?.some((think) => think.key === current)
        ? current
        : next.thinks?.[0]?.key || ''
    )
  }, [])

  const ensureEditable = useCallback(() => {
    if (!readonly) {
      return true
    }
    toast.info('大脑已发布，请先进入编辑草稿后再修改')
    return false
  }, [readonly])

  const loadWorkspace = useCallback(async () => {
    if (!brainID) {
      return
    }
    setLoading(true)
    try {
      const result = await request(workspaceApi, 'get', { brain_id: brainID })
      if (result.code !== 0) {
        throw new Error(result.message || '加载大脑失败')
      }
      applyWorkspaceData(result.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载大脑失败')
    } finally {
      setLoading(false)
    }
  }, [applyWorkspaceData, brainID, workspaceApi])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const saveThinkGraph = async () => {
    if (!brainID) {
      return
    }
    if (!ensureEditable()) {
      return
    }
    setSaving(true)
    try {
      const result = await request(saveThinkApi, 'post', {
        brain_id: brainID,
        thinks,
        edges: thinkEdges,
      })
      if (result.code !== 0) {
        throw new Error(result.message || '保存思维图失败')
      }
      applyWorkspaceData(result.data)
      toast.success('思维视图已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存思维图失败')
    } finally {
      setSaving(false)
    }
  }

  const saveNodeGraph = async () => {
    if (!ensureEditable()) {
      return
    }
    if (!activeThink?.id) {
      toast.error('请先保存思维，再配置节点')
      return
    }
    setSaving(true)
    try {
      const result = await request(saveNodeApi, 'post', {
        think_id: activeThink.id,
        nodes: normalizeNodesForSave(activeNodes),
        edges: activeNodeEdges,
      })
      if (result.code !== 0) {
        throw new Error(result.message || '保存节点图失败')
      }
      applyWorkspaceData(result.data)
      toast.success('节点视图已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存节点图失败')
    } finally {
      setSaving(false)
    }
  }

  const saveCreateConfig = async () => {
    if (!ensureEditable()) {
      return
    }
    if (!activeThink?.id) {
      toast.error('请先保存思维，再配置创作能力')
      return
    }
    setSaving(true)
    try {
      const result = await request(saveCreateApi, 'post', {
        think_id: activeThink.id,
        config: activeThink.config ?? {},
        create_powers: normalizeCreatePowersForSave(activeCreatePowers),
      })
      if (result.code !== 0) {
        throw new Error(result.message || '保存创作配置失败')
      }
      applyWorkspaceData(result.data)
      toast.success('创作配置已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存创作配置失败')
    } finally {
      setSaving(false)
    }
  }

  const publishBrain = async () => {
    if (!brainID || saving) {
      return
    }
    setSaving(true)
    try {
      const result = await request(saveThinkApi, 'post', {
        brain_id: brainID,
        action: 'publish',
      })
      if (result.code !== 0) {
        throw new Error(result.message || '发布失败')
      }
      applyWorkspaceData(result.data)
      setView('think')
      setSelection(null)
      setConnect(null)
      setEditorOpen(false)
      toast.success('大脑已发布')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发布失败')
    } finally {
      setSaving(false)
    }
  }

  const editDraft = async () => {
    if (!brainID || saving) {
      return
    }
    setSaving(true)
    try {
      const result = await request(saveThinkApi, 'post', {
        brain_id: brainID,
        action: 'edit_draft',
      })
      if (result.code !== 0) {
        throw new Error(result.message || '进入编辑草稿失败')
      }
      applyWorkspaceData(result.data)
      toast.success('已进入编辑草稿')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '进入编辑草稿失败')
    } finally {
      setSaving(false)
    }
  }

  const saveCurrentGraph =
    view === 'think' ? saveThinkGraph : view === 'create' ? saveCreateConfig : saveNodeGraph

  const openEditor = (target: Exclude<Selection, null>) => {
    if (!ensureEditable()) {
      return
    }
    setSelection(target)
    setEditorOpen(true)
  }

  const openThink = (think: ThinkItem) => {
    setSelectedThinkKey(think.key)
    setSelection(null)
    setView(isFlowThink(think) ? 'node' : 'create')
  }

  const requestDelete = (target: Exclude<Selection, null>) => {
    if (!ensureEditable()) {
      return
    }
    setSelection(target)
    setDeleteTarget(target)
  }

  const confirmDelete = () => {
    if (!ensureEditable()) {
      return
    }
    if (!deleteTarget) {
      return
    }

    const deletingActiveThink =
      deleteTarget.kind === 'think' && deleteTarget.key === selectedThinkKey
    const nextThink = deletingActiveThink
      ? (workspace.thinks ?? []).find((think) => think.key !== deleteTarget.key)
      : null

    setWorkspace((current) =>
      removeGraphSelection(current, deleteTarget, selectedThinkKey)
    )
    if (deletingActiveThink) {
      setSelectedThinkKey(nextThink?.key ?? '')
      if (!nextThink) {
        setView('think')
      } else if (!isFlowThink(nextThink)) {
        setView('create')
      }
    }
    setSelection(null)
    setDeleteTarget(null)
    setEditorOpen(false)
    toast.success(
      deleteTarget.kind === 'think' ? '已删除，保存后生效' : '已从画布移除，保存后生效'
    )
  }

  if (!brainID) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        缺少 brain_id，无法进入大脑思维配置。
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid min-h-[34rem] grid-cols-[16rem_minmax(0,1fr)] rounded-md border bg-background',
        view === 'create'
          ? 'overflow-visible'
          : 'h-[min(76vh,48rem)] overflow-hidden'
      )}
    >
      <aside className="flex min-h-0 min-w-0 flex-col border-r bg-muted/20">
        <div className="border-b p-4">
          <div className="text-xs text-muted-foreground">当前大脑</div>
          <div className="mt-1 truncate text-base font-semibold">{workspace.brain?.name || '大脑'}</div>
          <div className="mt-2 inline-flex rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {brainPublishStatusLabel(publishStatus)}
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">思维列表</span>
          <Button
            size="icon"
            variant="ghost"
            disabled={readonly}
            onClick={() => ensureEditable() && addThink(setWorkspace)}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3 pr-1"
          style={{ scrollbarGutter: 'stable' }}
        >
          <button
            type="button"
            className={cn(
              'mb-1 flex w-full select-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
              view === 'think'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
            onClick={() => {
              setView('think')
              setSelection(null)
            }}
          >
            <Network className="size-4" />
            思维视图
          </button>
          {thinks.map((think) => (
            <button
              key={think.key}
              type="button"
              draggable={!readonly}
              aria-grabbed={dragThinkKey === think.key}
              className={cn(
                'mb-1 flex w-full select-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                isActiveThinkListItem(view, selectedThinkKey, think)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
                dragThinkKey === think.key && 'opacity-60'
              )}
              onClick={() => openThink(think)}
              onDragStart={(event) => {
                if (readonly) {
                  event.preventDefault()
                  return
                }
                setDragThinkKey(think.key)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', think.key)
              }}
              onDragOver={(event) => {
                if (!readonly && dragThinkKey && dragThinkKey !== think.key) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (readonly || !dragThinkKey || dragThinkKey === think.key) {
                  return
                }
                setWorkspace((current) => reorderThinks(current, dragThinkKey, think.key))
                setDragThinkKey('')
              }}
              onDragEnd={() => setDragThinkKey('')}
            >
              <Workflow className="size-4" />
              <span className="min-w-0 flex-1 truncate">{think.name || think.key}</span>
              <span className="shrink-0 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {thinkTypeLabel(think.type)}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            disabled={readonly}
            onClick={() =>
              ensureEditable() &&
              (view === 'think'
                ? addThink(setWorkspace)
                : view === 'create'
                  ? addCreatePower(selectedThinkKey, setWorkspace)
                  : addNode(selectedThinkKey, setWorkspace))
            }
          >
            <Plus className="size-4" />
            {view === 'think' ? '新增思维' : view === 'create' ? '添加能力' : '新增节点'}
          </Button>
          {connect ? (
            <Button size="sm" variant="default" onClick={() => setConnect(null)}>
              <X className="size-4" />
              取消连线
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={saving || readonly}
            onClick={saveCurrentGraph}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            保存
          </Button>
          {readonly ? (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void editDraft()}>
              <SquarePen className="size-4" />
              编辑草稿
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void publishBrain()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              发布大脑
            </Button>
          )}
          {loading ? <span className="text-sm text-muted-foreground">加载中...</span> : null}
        </div>

        {view === 'create' ? (
          <CreateThinkConfigPanel
            think={activeThink}
            createPowers={activeCreatePowers}
            powers={powers}
            powerKinds={powerKinds}
            agents={agents}
            agentCates={agentCates}
            readonly={readonly}
            onChangeThinkConfig={(patch) =>
              activeThink && !readonly
                ? setWorkspace((current) => updateThinkConfig(current, activeThink.key, patch))
                : undefined
            }
            onAddPower={() => ensureEditable() && addCreatePower(selectedThinkKey, setWorkspace)}
            onChangePower={(index, patch) =>
              !readonly
                ? setWorkspace((current) =>
                    updateCreatePower(current, selectedThinkKey, index, patch)
                  )
                : undefined
            }
            onRemovePower={(index) =>
              ensureEditable()
                ? setWorkspace((current) => removeCreatePower(current, selectedThinkKey, index))
                : undefined
            }
            onReorderPower={(fromIndex, toIndex) =>
              !readonly
                ? setWorkspace((current) =>
                    reorderCreatePowers(current, selectedThinkKey, fromIndex, toIndex)
                  )
                : undefined
            }
          />
        ) : (
          <Canvas
            view={view}
            thinks={thinks}
            thinkEdges={thinkEdges}
            nodes={activeNodes}
            nodeEdges={activeNodeEdges}
            edgeConditions={edgeConditions}
            selected={selection}
            connect={connect}
            readonly={readonly}
            nodeTypes={nodeTypes}
            onSelect={setSelection}
            onConnect={setConnect}
            onEdit={openEditor}
            onDelete={requestDelete}
            onThinkConnect={(fromKey, toKey) =>
              !readonly
                ? setWorkspace((current) => addThinkEdge(current, fromKey, toKey))
                : undefined
            }
            onThinkConnectNew={(fromKey, position) => {
              if (!ensureEditable()) {
                return
              }
              const key = `think_${Date.now()}`
              setWorkspace((current) => addConnectedThink(current, fromKey, key, position))
              setSelection({ kind: 'think', key })
            }}
            onNodeConnect={(fromKey, toKey) =>
              !readonly
                ? setWorkspace((current) =>
                    addNodeEdge(current, selectedThinkKey, fromKey, toKey)
                  )
                : undefined
            }
            onNodeConnectNew={(fromKey, position) => {
              if (!ensureEditable() || !selectedThinkKey) {
                return
              }
              const key = `node_${Date.now()}`
              setWorkspace((current) =>
                addConnectedNode(current, selectedThinkKey, fromKey, key, position)
              )
              setSelection({ kind: 'node', key })
            }}
            onMove={(kind, key, position) =>
              !readonly
                ? setWorkspace((current) =>
                    kind === 'think'
                      ? updateThink(current, key, { position })
                      : updateNode(current, selectedThinkKey, key, { position })
                  )
                : undefined
            }
            onChangeNodeEdge={(index, patch) =>
              !readonly
                ? setWorkspace((current) =>
                    updateNodeEdge(current, selectedThinkKey, index, patch)
                  )
                : undefined
            }
          />
        )}

      </section>

      <EditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        selected={selection}
        thinks={thinks}
        nodes={activeNodes}
        agents={agents}
        agentCates={agentCates}
        powers={powers}
        powerKinds={powerKinds}
        nodeTypes={nodeTypes}
        readonly={readonly}
        onChangeThink={(key, patch) =>
          !readonly ? setWorkspace((current) => updateThink(current, key, patch)) : undefined
        }
        onChangeNode={(key, patch) =>
          !readonly
            ? setWorkspace((current) => updateNode(current, selectedThinkKey, key, patch))
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.kind === 'think' ? '删除思维' : '删除图中项目'}
        desc={
          deleteTarget?.kind === 'think'
            ? '保存后该思维会被停用，不做物理删除，已发布或历史运行数据不会被直接清掉。'
            : '删除后会同时移除关联连线。保存前仍只在当前编辑状态中生效。'
        }
        confirmText="删除"
        destructive
        handleConfirm={confirmDelete}
      />
    </div>
  )
}

function Canvas({
  view,
  thinks,
  thinkEdges,
  nodes,
  nodeEdges,
  edgeConditions,
  selected,
  connect,
  readonly,
  nodeTypes,
  onSelect,
  onConnect,
  onEdit,
  onDelete,
  onThinkConnect,
  onThinkConnectNew,
  onNodeConnect,
  onNodeConnectNew,
  onMove,
  onChangeNodeEdge,
}: {
  view: 'think' | 'node'
  thinks: ThinkItem[]
  thinkEdges: ThinkEdge[]
  nodes: BrainNode[]
  nodeEdges: NodeEdge[]
  edgeConditions: Array<{ id: string; value: string }>
  selected: Selection
  connect: ConnectState
  readonly: boolean
  nodeTypes: Array<{ id: string; value: string }>
  onSelect: (selection: Selection) => void
  onConnect: (connect: ConnectState) => void
  onEdit: (selection: Exclude<Selection, null>) => void
  onDelete: (selection: Exclude<Selection, null>) => void
  onThinkConnect: (fromKey: string, toKey: string) => void
  onThinkConnectNew: (fromKey: string, position: CanvasPoint) => void
  onNodeConnect: (fromKey: string, toKey: string) => void
  onNodeConnectNew: (fromKey: string, position: CanvasPoint) => void
  onMove: (kind: 'think' | 'node', key: string, position: Record<string, any>) => void
  onChangeNodeEdge: (index: number, patch: Partial<NodeEdge>) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [connectPointer, setConnectPointer] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState<CanvasPanState>(null)
  const [dragging, setDragging] = useState<{
    kind: 'think' | 'node'
    key: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const items = view === 'think' ? thinks : nodes
  const edges = view === 'think' ? thinkEdges : nodeEdges
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number }>()
    items.forEach((item: any, index) => {
      const key = view === 'think' ? item.key : item.node_key
      const fallback = defaultGraphPosition(index)
      result.set(key, {
        x: Number(item.position?.x ?? fallback.x),
        y: Number(item.position?.y ?? fallback.y),
      })
    })
    return result
  }, [items, view])

  useEffect(() => {
    if (!dragging || readonly) {
      return
    }
    const handleMove = (event: MouseEvent) => {
      const point = toCanvasPoint(canvasRef.current, event, zoom)
      onMove(dragging.kind, dragging.key, {
        x: Math.max(16, point.x - dragging.offsetX),
        y: Math.max(16, point.y - dragging.offsetY),
      })
    }
    const handleUp = () => setDragging(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, onMove, readonly, zoom])

  useEffect(() => {
    if (!panning) {
      return
    }
    const handleMove = (event: MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }
      canvas.scrollLeft = panning.scrollLeft - (event.clientX - panning.x)
      canvas.scrollTop = panning.scrollTop - (event.clientY - panning.y)
    }
    const handleUp = () => setPanning(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [panning])

  useEffect(() => {
    if (readonly) {
      setConnectPointer(null)
      return
    }
    if (!connect) {
      setConnectPointer(null)
      return
    }

    const updatePointer = (event: MouseEvent) => {
      setConnectPointer(toCanvasPoint(canvasRef.current, event, zoom))
    }
    const finishConnect = (event: MouseEvent) => {
      const point = toCanvasPoint(canvasRef.current, event, zoom)
      const targetKey = findCardAtPoint(positions, point)
      if (targetKey && targetKey !== connect.fromKey) {
        if (view === 'think') {
          onThinkConnect(connect.fromKey, targetKey)
        } else {
          onNodeConnect(connect.fromKey, targetKey)
        }
      } else if (!targetKey && isMeaningfulConnectDrag(positions.get(connect.fromKey), point)) {
        const position = clampGraphPosition({
          x: point.x,
          y: point.y - CARD_HEIGHT / 2,
        })
        if (view === 'think') {
          onThinkConnectNew(connect.fromKey, position)
        } else {
          onNodeConnectNew(connect.fromKey, position)
        }
      }
      onConnect(null)
      setConnectPointer(null)
    }

    window.addEventListener('mousemove', updatePointer)
    window.addEventListener('mouseup', finishConnect)
    return () => {
      window.removeEventListener('mousemove', updatePointer)
      window.removeEventListener('mouseup', finishConnect)
    }
  }, [
    connect,
    onConnect,
    onNodeConnect,
    onNodeConnectNew,
    onThinkConnect,
    onThinkConnectNew,
    positions,
    readonly,
    view,
    zoom,
  ])

  useEffect(() => {
    if (!contextMenu) {
      return
    }
    const close = () => setContextMenu(null)
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', closeWithKeyboard)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', closeWithKeyboard)
    }
  }, [contextMenu])

  const openContextMenu = (
    event: ReactMouseEvent,
    target: Exclude<Selection, null>
  ) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect(target)
    if (readonly) {
      return
    }
    setContextMenu({ x: event.clientX, y: event.clientY, target })
  }

  const handleCardClick = (key: string) => {
    onSelect(view === 'think' ? { kind: 'think', key } : { kind: 'node', key })
  }

  const zoomTo = useCallback(
    (nextZoom: number, anchor?: CanvasPoint) => {
      const canvas = canvasRef.current
      const clampedZoom = clampZoom(nextZoom)
      if (!canvas || clampedZoom === zoom) {
        setZoom(clampedZoom)
        return
      }

      const rect = canvas.getBoundingClientRect()
      const anchorClient = anchor ?? {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }
      const graphPoint = {
        x: (anchorClient.x - rect.left + canvas.scrollLeft) / zoom,
        y: (anchorClient.y - rect.top + canvas.scrollTop) / zoom,
      }

      setZoom(clampedZoom)
      window.requestAnimationFrame(() => {
        canvas.scrollLeft = graphPoint.x * clampedZoom - (anchorClient.x - rect.left)
        canvas.scrollTop = graphPoint.y * clampedZoom - (anchorClient.y - rect.top)
      })
    },
    [zoom]
  )

  const fitView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || positions.size === 0) {
      zoomTo(1)
      return
    }

    const bounds = getGraphBounds(positions)
    const padding = 160
    const nextZoom = clampZoom(
      Math.min(
        canvas.clientWidth / (bounds.width + padding * 2),
        canvas.clientHeight / (bounds.height + padding * 2),
        1.2
      )
    )

    setZoom(nextZoom)
    window.requestAnimationFrame(() => {
      canvas.scrollLeft = Math.max(0, (bounds.x - padding) * nextZoom)
      canvas.scrollTop = Math.max(0, (bounds.y - padding) * nextZoom)
    })
  }, [positions, zoomTo])

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return
    }
    event.preventDefault()
    zoomTo(zoom + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), {
      x: event.clientX,
      y: event.clientY,
    })
  }

  const startPan = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || connect) {
      return
    }
    const target = event.target as HTMLElement
    if (target.closest('[data-graph-interactive="true"]')) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    event.preventDefault()
    setPanning({
      x: event.clientX,
      y: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    })
  }

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden bg-background">
      <div
        ref={canvasRef}
        className={cn(
          'absolute inset-0 select-none overflow-auto',
          connect ? 'cursor-crosshair' : panning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onClick={() => setContextMenu(null)}
        onMouseDown={startPan}
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{
            width: CANVAS_WIDTH * zoom,
            height: CANVAS_HEIGHT * zoom,
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="pointer-events-none absolute inset-0 size-full">
              {edges.map((edge: any, index) => {
                const fromKey = edge.from_key
                const toKey = edge.to_key
                const from = positions.get(fromKey)
                const to = positions.get(toKey)
                if (!from || !to) {
                  return null
                }
                const selectedEdge =
                  selected?.kind === (view === 'think' ? 'think_edge' : 'node_edge') &&
                  selected.index === index
                const path = connectorPath(connectorStartPoint(from), connectorEndPoint(to))
                return (
                  <g key={`${fromKey}-${toKey}-${index}`}>
                    <path
                      d={path}
                      fill="none"
                      stroke={selectedEdge ? '#2563eb' : '#cbd5e1'}
                      strokeLinecap="round"
                      strokeWidth={selectedEdge ? 3 : 2}
                      markerEnd={
                        selectedEdge ? 'url(#brain-arrow-selected)' : 'url(#brain-arrow)'
                      }
                    />
                  </g>
                )
              })}
              {connect && connectPointer && positions.get(connect.fromKey) ? (
                <path
                  d={connectorPath(
                    connectorStartPoint(positions.get(connect.fromKey)!),
                    connectPointer
                  )}
                  fill="none"
                  stroke="#2563eb"
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                  strokeWidth={2}
                />
              ) : null}
              <defs>
                <marker
                  id="brain-arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L8,3 z" fill="#cbd5e1" />
                </marker>
                <marker
                  id="brain-arrow-selected"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L8,3 z" fill="#2563eb" />
                </marker>
              </defs>
            </svg>
            {edges.map((edge: any, index) => {
              const from = positions.get(edge.from_key)
              const to = positions.get(edge.to_key)
              if (!from || !to) return null
              const edgeSelection =
                view === 'think'
                  ? ({ kind: 'think_edge', index } as const)
                  : ({ kind: 'node_edge', index } as const)
              const isThinkEdge = view === 'think'
              const conditionOptions = isThinkEdge
                ? []
                : resolveNodeEdgeConditionOptions(edge, nodes, edgeConditions)
              const configurableEdge = conditionOptions.length > 0
              const left = (from.x + to.x) / 2 + CARD_WIDTH / 2
              const top = (from.y + to.y) / 2 + CARD_HEIGHT / 2
              if (!configurableEdge) {
                return (
                  <button
                    key={`edge-button-${edge.from_key}-${edge.to_key}-${index}`}
                    type="button"
                    data-graph-interactive="true"
                    className="absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background text-xs text-foreground shadow-sm"
                    title="右键删除关系"
                    style={{ left, top }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(edgeSelection)
                    }}
                    onContextMenu={(event) => openContextMenu(event, edgeSelection)}
                  />
                )
              }
              const fallbackCondition = conditionOptions[0]?.id ?? ''
              const condition = conditionOptions.some((item) => item.id === edge.condition)
                ? edge.condition || fallbackCondition
                : fallbackCondition
              return (
                <div
                  key={`edge-button-${edge.from_key}-${edge.to_key}-${index}`}
                  data-graph-interactive="true"
                  className="absolute z-10 w-24 -translate-x-1/2 -translate-y-1/2"
                  style={{ left, top }}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(edgeSelection)
                  }}
                  onContextMenu={(event) => openContextMenu(event, edgeSelection)}
                >
                  <Select
                    value={condition}
                    disabled={readonly}
                    onValueChange={(value) => onChangeNodeEdge(index, { condition: value })}
                  >
                    <SelectTrigger className="h-7 justify-center rounded-full bg-background px-3 pr-3 text-xs shadow-sm [&_.select-trigger-chevron]:hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
            {items.map((item: any) => {
              const key = view === 'think' ? item.key : item.node_key
              const position = positions.get(key) ?? { x: 80, y: 80 }
              const targetSelection =
                view === 'think'
                  ? ({ kind: 'think', key } as const)
                  : ({ kind: 'node', key } as const)
              const isSelected =
                selected?.kind === (view === 'think' ? 'think' : 'node') &&
                selected.key === key
              const isConnecting = connect?.kind === view && connect.fromKey === key
              return (
                <div
                  key={key}
                  data-graph-interactive="true"
                  className={cn(
                    'group absolute z-20 h-[116px] w-48 select-none rounded-md border bg-background p-3 shadow-sm',
                    readonly ? 'cursor-pointer' : connect ? 'cursor-crosshair' : 'cursor-move',
                    isSelected && 'border-primary ring-2 ring-primary/30',
                    isConnecting && 'border-amber-400 ring-2 ring-amber-300/40'
                  )}
                  style={{ left: position.x, top: position.y }}
                  onClick={() => handleCardClick(key)}
                  onContextMenu={(event) => openContextMenu(event, targetSelection)}
                  onMouseDown={(event) => {
                    if (event.button !== 0) {
                      return
                    }
                    if (readonly) {
                      return
                    }
                    event.stopPropagation()
                    const rect = event.currentTarget.getBoundingClientRect()
                    setDragging({
                      kind: view,
                      key,
                      offsetX: (event.clientX - rect.left) / zoom,
                      offsetY: (event.clientY - rect.top) / zoom,
                    })
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{item.name || key}</div>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {view === 'think'
                        ? thinkTypeLabel(item.type)
                        : nodeTypeLabel(item.type, nodeTypes)}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {view === 'think' ? item.goal || item.key : item.node_key}
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={readonly}
                      className="grid size-7 place-items-center rounded-md border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                      title="编辑"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(targetSelection)
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <SquarePen className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={readonly}
                      className="grid size-7 place-items-center rounded-md border bg-background text-destructive shadow-sm hover:bg-destructive/10"
                      title="删除"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(targetSelection)
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {!readonly ? (
                    <button
                      type="button"
                      className={cn(
                        'absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full',
                        'cursor-crosshair border bg-background shadow-sm',
                        'hover:border-blue-400 hover:bg-blue-50'
                      )}
                      aria-label="拖拽连线"
                      title="拖拽连线"
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setConnectPointer(toCanvasPoint(canvasRef.current, event.nativeEvent, zoom))
                        onConnect({ kind: view, fromKey: key })
                      }}
                    />
                  ) : null}
                  <span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border bg-background" />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <CanvasZoomControls
        zoom={zoom}
        onZoomIn={() => zoomTo(zoom + ZOOM_STEP)}
        onZoomOut={() => zoomTo(zoom - ZOOM_STEP)}
        onFitView={fitView}
      />
      <CanvasContextMenu
        menu={contextMenu}
        onEdit={(target) => {
          setContextMenu(null)
          onEdit(target)
        }}
        onDelete={(target) => {
          setContextMenu(null)
          onDelete(target)
        }}
      />
    </div>
  )
}

function CanvasZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
}) {
  return (
    <div
      data-graph-interactive="true"
      className="absolute right-3 top-3 z-40 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm"
    >
      <Button size="icon" variant="ghost" className="size-8" title="缩小" onClick={onZoomOut}>
        <ZoomOut className="size-4" />
      </Button>
      <div className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </div>
      <Button size="icon" variant="ghost" className="size-8" title="放大" onClick={onZoomIn}>
        <ZoomIn className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-8" title="适应视图" onClick={onFitView}>
        <Maximize2 className="size-4" />
      </Button>
    </div>
  )
}

function CanvasContextMenu({
  menu,
  onEdit,
  onDelete,
}: {
  menu: ContextMenuState
  onEdit: (selection: Exclude<Selection, null>) => void
  onDelete: (selection: Exclude<Selection, null>) => void
}) {
  if (!menu) {
    return null
  }

  return (
    <div
      className="fixed z-50 min-w-32 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.target.kind === 'think' || menu.target.kind === 'node' ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
          onClick={() => onEdit(menu.target)}
        >
          <SquarePen className="size-4" />
          编辑
        </button>
      ) : null}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
        onClick={() => onDelete(menu.target)}
      >
        <Trash2 className="size-4" />
        删除
      </button>
    </div>
  )
}

function toCanvasPoint(
  container: HTMLDivElement | null,
  event: MouseEvent,
  zoom = 1
) {
  const rect = container?.getBoundingClientRect()
  if (!rect || !container) {
    return { x: 0, y: 0 }
  }
  return {
    x: (event.clientX - rect.left + container.scrollLeft) / zoom,
    y: (event.clientY - rect.top + container.scrollTop) / zoom,
  }
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

function getGraphBounds(positions: Map<string, CanvasPoint>) {
  let minX = CANVAS_WIDTH
  let minY = CANVAS_HEIGHT
  let maxX = 0
  let maxY = 0

  positions.forEach((position) => {
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + CARD_WIDTH)
    maxY = Math.max(maxY, position.y + CARD_HEIGHT)
  })

  return {
    x: minX,
    y: minY,
    width: Math.max(CARD_WIDTH, maxX - minX),
    height: Math.max(CARD_HEIGHT, maxY - minY),
  }
}

function findCardAtPoint(
  positions: Map<string, { x: number; y: number }>,
  point: { x: number; y: number }
) {
  for (const [key, position] of positions.entries()) {
    const withinX = point.x >= position.x && point.x <= position.x + CARD_WIDTH
    const withinY = point.y >= position.y && point.y <= position.y + CARD_HEIGHT
    if (withinX && withinY) {
      return key
    }
  }
  return ''
}

function connectorStartPoint(position: CanvasPoint) {
  return {
    x: position.x + CARD_WIDTH,
    y: position.y + CARD_HEIGHT / 2,
  }
}

function connectorEndPoint(position: CanvasPoint) {
  return {
    x: position.x,
    y: position.y + CARD_HEIGHT / 2,
  }
}

function connectorPath(start: CanvasPoint, end: CanvasPoint) {
  const direction = end.x >= start.x ? 1 : -1
  const distance = Math.abs(end.x - start.x)
  const controlOffset = Math.max(80, Math.min(240, distance * 0.45))
  const controlStartX = start.x + controlOffset * direction
  const controlEndX = end.x - controlOffset * direction

  return [
    `M ${start.x} ${start.y}`,
    `C ${controlStartX} ${start.y}, ${controlEndX} ${end.y}, ${end.x} ${end.y}`,
  ].join(' ')
}

function isMeaningfulConnectDrag(
  source: { x: number; y: number } | undefined,
  point: CanvasPoint
) {
  if (!source) {
    return false
  }
  const start = connectorStartPoint(source)
  return Math.hypot(point.x - start.x, point.y - start.y) > 48
}

function clampGraphPosition(point: CanvasPoint) {
  return {
    x: Math.max(16, Math.min(CANVAS_WIDTH - CARD_WIDTH - 16, point.x)),
    y: Math.max(16, Math.min(CANVAS_HEIGHT - CARD_HEIGHT - 16, point.y)),
  }
}

function EditorDialog({
  open,
  onOpenChange,
  selected,
  thinks,
  nodes,
  agents,
  agentCates,
  powers,
  powerKinds,
  nodeTypes,
  readonly,
  onChangeThink,
  onChangeNode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: Selection
  thinks: ThinkItem[]
  nodes: BrainNode[]
  agents: AgentOption[]
  agentCates: AgentCateOption[]
  powers: PowerOption[]
  powerKinds: PowerKindOption[]
  nodeTypes: Array<{ id: string; value: string }>
  readonly: boolean
  onChangeThink: (key: string, patch: Partial<ThinkItem>) => void
  onChangeNode: (key: string, patch: Partial<BrainNode>) => void
}) {
  if (!selected) {
    return null
  }

  const title = resolveEditorTitle(selected)

  let content: ReactNode = null
  let headerAction: ReactNode = null
  if (selected.kind === 'think') {
    const think = thinks.find((item) => item.key === selected.key)
    if (think) {
      const assistantContext = buildThinkAssistantContext(think)
      headerAction = readonly ? null : (
        <AssistantContextFormFillButton
          context={assistantContext}
          variant="outline"
          size="sm"
          onApplyValues={(values) =>
            applyThinkAssistantValues(think.key, values, onChangeThink)
          }
        />
      )
      content = (
        <div className="space-y-1">
          <Field label="名称">
            <Input
              value={think.name || ''}
              disabled={readonly}
              onChange={(event) => onChangeThink(think.key, { name: event.target.value })}
            />
          </Field>
          <Field label="思维类型">
            <OptionRadioGroup
              options={THINK_TYPES}
              value={normalizeThinkType(think.type)}
              onValueChange={(value) => onChangeThink(think.key, { type: value })}
              disabled={readonly}
            />
          </Field>
          {isFlowThink(think) ? (
            <Field label="目标">
              <Textarea
                value={think.goal || ''}
                disabled={readonly}
                onChange={(event) => onChangeThink(think.key, { goal: event.target.value })}
              />
            </Field>
          ) : null}
        </div>
      )
    }
  } else if (selected.kind === 'node') {
    const node = nodes.find((item) => item.node_key === selected.key)
    content = node ? (
      <div className="space-y-1">
        <Field label="名称">
          <Input
            value={node.name || ''}
            disabled={readonly}
            onChange={(event) => onChangeNode(node.node_key, { name: event.target.value })}
          />
        </Field>
        <Field label="类型">
          <OptionRadioGroup
            options={nodeTypes}
            value={node.type || 'agent'}
            onValueChange={(value) =>
              onChangeNode(node.node_key, normalizeNodeTypePatch(node, value))
            }
            disabled={readonly}
          />
        </Field>
        {node.type === 'agent' ? (
          <AgentBindingFields
            node={node}
            agents={agents}
            agentCates={agentCates}
            readonly={readonly}
            onChangeNode={onChangeNode}
          />
        ) : null}
        {node.type === 'power' ? (
          <PowerBindingFields
            node={node}
            powers={powers}
            powerKinds={powerKinds}
            readonly={readonly}
            onChangeNode={onChangeNode}
          />
        ) : null}
        {node.type === 'condition' ? (
          <ConditionFields node={node} readonly={readonly} onChangeNode={onChangeNode} />
        ) : null}
      </div>
    ) : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(82vh,48rem)] overflow-visible sm:max-w-2xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 pr-8 text-left">
          <DialogTitle>{title}</DialogTitle>
          {headerAction}
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}

function OptionRadioGroup({
  options,
  value,
  disabled,
  onValueChange,
}: {
  options: Array<{ id: string; value: string }>
  value: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onValueChange}
      className="grid gap-2 sm:grid-cols-2"
      disabled={disabled}
    >
      {options.map((option) => (
        <label
          key={option.id}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
            value === option.id && 'border-primary bg-primary/5 text-primary',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <RadioGroupItem value={option.id} disabled={disabled} />
          <span>{option.value}</span>
        </label>
      ))}
    </RadioGroup>
  )
}

function CreateThinkConfigPanel({
  think,
  createPowers,
  powers,
  powerKinds,
  agents,
  agentCates,
  readonly,
  onChangeThinkConfig,
  onAddPower,
  onChangePower,
  onRemovePower,
  onReorderPower,
}: {
  think?: ThinkItem
  createPowers: ThinkCreatePower[]
  powers: PowerOption[]
  powerKinds: PowerKindOption[]
  agents: AgentOption[]
  agentCates: AgentCateOption[]
  readonly: boolean
  onChangeThinkConfig: (patch: Record<string, any>) => void
  onAddPower: () => void
  onChangePower: (index: number, patch: Partial<ThinkCreatePower>) => void
  onRemovePower: (index: number) => void
  onReorderPower: (fromIndex: number, toIndex: number) => void
}) {
  const [dragPowerIndex, setDragPowerIndex] = useState<number | null>(null)

  if (!think) {
    return (
      <div className="flex min-h-0 items-center justify-center text-sm text-muted-foreground">
        请选择一个创作。
      </div>
    )
  }

  const defaultAgentID = Number(think.config?.default_agent_id || 0)
  const selectedAgent = agents.find((agent) => agent.id === defaultAgentID)
  const defaultCateID = Number(
    selectedAgent?.cate_id || think.config?.default_agent_cate_id || 0
  )
  const kinds = powerKinds.length ? powerKinds : derivePowerKindOptions(powers)

  return (
    <div className="min-h-0 bg-background p-4">
      <div className="mx-auto max-w-5xl space-y-4 pb-4">
        <section className="rounded-md border bg-background p-4">
          <div className="mb-3">
            <div className="text-base font-semibold">{think.name || '创作'}</div>
            <div className="text-xs text-muted-foreground">
              配置前台创作画布可调用的智能体和能力。
            </div>
          </div>
          <Field label="智能体">
            <AgentSelector
              agentID={defaultAgentID}
              cateID={defaultCateID}
              agents={agents}
              agentCates={agentCates}
              disabled={readonly}
              onChange={({ agentID, cateID }) =>
                onChangeThinkConfig({
                  default_agent_id: agentID,
                  default_agent_cate_id: cateID,
                })
              }
            />
          </Field>
        </section>

        <section className="rounded-md border bg-background">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <div>
              <div className="font-semibold">能力配置</div>
              <div className="text-xs text-muted-foreground">
                每一行表示创作画布里一种能力类型可选择的一组能力。
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={readonly} onClick={onAddPower}>
              <Plus className="size-4" />
              添加能力
            </Button>
          </div>
          <div className="hidden grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div>拖动排序</div>
            <div>能力类型</div>
            <div>能力选择</div>
            <div className="text-center">操作</div>
          </div>
          <div className="divide-y">
            {createPowers.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">还没有配置能力。</div>
            ) : (
              createPowers.map((item, index) => {
                const kind = item.kind || kinds[0]?.id || powers[0]?.kind || ''
                return (
                  <div
                    key={`${item.id || kind || 'power'}-${index}`}
                    className={cn(
                      'grid items-center gap-3 p-4 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem]',
                      dragPowerIndex === index && 'bg-muted/40'
                    )}
                    onDragOver={(event) => {
                      if (!readonly && dragPowerIndex !== null && dragPowerIndex !== index) {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (readonly || dragPowerIndex === null || dragPowerIndex === index) {
                        return
                      }
                      onReorderPower(dragPowerIndex, index)
                      setDragPowerIndex(null)
                    }}
                  >
                    <button
                      type="button"
                      draggable={!readonly}
                      disabled={readonly}
                      className="grid size-9 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                      title="拖动排序"
                      onDragStart={(event) => {
                        if (readonly) {
                          event.preventDefault()
                          return
                        }
                        setDragPowerIndex(index)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', String(index))
                      }}
                      onDragEnd={() => setDragPowerIndex(null)}
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <PowerSelector
                      kind={kind}
                      powerIDs={normalizeCreatePowerIDs(item)}
                      kinds={kinds}
                      powers={powers}
                      disabled={readonly}
                      onChange={(patch) => onChangePower(index, patch)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={readonly}
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => onRemovePower(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function AgentBindingFields({
  node,
  agents,
  agentCates,
  readonly,
  onChangeNode,
}: {
  node: BrainNode
  agents: AgentOption[]
  agentCates: AgentCateOption[]
  readonly: boolean
  onChangeNode: (key: string, patch: Partial<BrainNode>) => void
}) {
  return (
    <Field label="绑定智能体">
      <AgentSelector
        agentID={node.agent_id}
        cateID={Number(node.config?.agent_cate_id || 0)}
        agents={agents}
        agentCates={agentCates}
        disabled={readonly}
        onChange={({ agentID, cateID }) =>
          onChangeNode(node.node_key, {
            agent_id: agentID,
            config: {
              ...(node.config ?? {}),
              agent_cate_id: cateID,
            },
          })
        }
      />
    </Field>
  )
}

function PowerBindingFields({
  node,
  powers,
  powerKinds,
  readonly,
  onChangeNode,
}: {
  node: BrainNode
  powers: PowerOption[]
  powerKinds: PowerKindOption[]
  readonly: boolean
  onChangeNode: (key: string, patch: Partial<BrainNode>) => void
}) {
  const selectedPowerID = Number(node.config?.power_id || 0)
  const selectedPower = powers.find((power) => power.id === selectedPowerID)
  const kinds = powerKinds.length ? powerKinds : derivePowerKindOptions(powers)
  const selectedKind =
    String(node.config?.power_kind || selectedPower?.kind || kinds[0]?.id || powers[0]?.kind || '')
  const filteredPowers = selectedKind
    ? powers.filter((power) => power.kind === selectedKind)
    : powers

  return (
    <Field label="绑定能力">
      <div className="grid gap-2 sm:grid-cols-2">
        <SearchableOptionPicker
          value={selectedKind || undefined}
          options={kinds.map((kind) => ({ id: kind.id, value: kind.value }))}
          disabled={readonly}
          clearable={false}
          placeholder="选择能力类型"
          searchPlaceholder="输入能力类型筛选..."
          onChange={(nextValue) => {
            const value = Array.isArray(nextValue) ? nextValue[0] ?? '' : nextValue
            const nextPower = powers.find((power) => power.kind === value)
            onChangeNode(node.node_key, {
              config: {
                ...(node.config ?? {}),
                power_kind: value,
                power_id: nextPower?.id || 0,
                power_key: nextPower?.key || '',
              },
            })
          }}
        />
        <SearchableOptionPicker
          value={selectedPowerID ? String(selectedPowerID) : undefined}
          options={filteredPowers.map((power) => ({
            id: power.id,
            value: power.name || '未命名能力',
          }))}
          disabled={readonly}
          placeholder="选择能力"
          searchPlaceholder="输入能力筛选..."
          emptyText="未找到匹配能力"
          onClear={() =>
            onChangeNode(node.node_key, {
              config: {
                ...(node.config ?? {}),
                power_id: 0,
                power_key: '',
              },
            })
          }
          onChange={(nextValue) => {
            const value = Array.isArray(nextValue) ? nextValue[0] ?? '' : nextValue
            const nextPower = powers.find((power) => String(power.id) === String(value))
            onChangeNode(node.node_key, {
              config: {
                ...(node.config ?? {}),
                power_kind: nextPower?.kind || selectedKind,
                power_id: nextPower?.id || 0,
                power_key: nextPower?.key || '',
              },
            })
          }}
        />
      </div>
    </Field>
  )
}

function ConditionFields({
  node,
  readonly,
  onChangeNode,
}: {
  node: BrainNode
  readonly: boolean
  onChangeNode: (key: string, patch: Partial<BrainNode>) => void
}) {
  const operator = normalizeConditionOperator(node.config?.operator)
  const needsValue = operator === 'contains' || operator === 'equals'
  const updateConfig = (patch: Record<string, any>) =>
    onChangeNode(node.node_key, {
      config: {
        ...(node.config ?? {}),
        ...patch,
      },
    })

  return (
    <>
      <Field label="判断方式">
        <OptionRadioGroup
          options={CONDITION_OPERATORS}
          value={operator}
          disabled={readonly}
          onValueChange={(value) => updateConfig({ operator: value })}
        />
      </Field>
      {needsValue ? (
        <Field label="判断值">
          <Input
            value={String(node.config?.value ?? '')}
            disabled={readonly}
            placeholder={operator === 'contains' ? '输入要包含的内容' : '输入要完全等于的内容'}
            onChange={(event) => updateConfig({ value: event.target.value })}
          />
        </Field>
      ) : null}
    </>
  )
}

function PowerSelector({
  kind,
  powerIDs,
  kinds,
  powers,
  disabled = false,
  onChange,
}: {
  kind: string
  powerIDs: number[]
  kinds: PowerKindOption[]
  powers: PowerOption[]
  disabled?: boolean
  onChange: (patch: Partial<ThinkCreatePower>) => void
}) {
  const currentPower = powers.find((power) => powerIDs.includes(power.id))
  const selectedKind = kind || currentPower?.kind || kinds[0]?.id || powers[0]?.kind || ''
  const filteredPowers = selectedKind
    ? powers.filter((power) => power.kind === selectedKind)
    : powers
  const kindOptions = kinds.map((kind) => ({ id: kind.id, value: kind.value }))
  const powerOptions = filteredPowers.map((power) => ({
    id: power.id,
    value: power.name || '未命名能力',
  }))

  return (
    <>
      <SearchableOptionPicker
        value={selectedKind || undefined}
        options={kindOptions}
        disabled={disabled}
        clearable={false}
        placeholder="选择能力类型"
        searchPlaceholder="输入能力类型筛选..."
        onChange={(nextValue) => {
          const value = Array.isArray(nextValue) ? nextValue[0] ?? '' : nextValue
          const nextPower = powers.find((power) => power.kind === value)
          onChange({
            kind: value,
            power_id: currentPower?.kind === value ? powerIDs[0] || 0 : nextPower?.id || 0,
            power_ids: currentPower?.kind === value
              ? powerIDs
              : nextPower?.id
                ? [nextPower.id]
                : [],
          })
        }}
      />
      <SearchableOptionPicker
        value={powerIDs.map(String)}
        options={powerOptions}
        multiple
        disabled={disabled}
        placeholder="选择能力"
        searchPlaceholder="输入能力筛选..."
        emptyText="未找到匹配能力"
        onClear={() => {
          onChange({
            power_id: 0,
            power_ids: [],
          })
        }}
        onChange={(nextValue) => {
          const values = Array.isArray(nextValue) ? nextValue : [String(nextValue)]
          const nextPowerIDs = values.map(Number).filter(Boolean)
          onChange({
            power_id: nextPowerIDs[0] || 0,
            power_ids: nextPowerIDs,
          })
        }}
      />
    </>
  )
}

function AgentSelector({
  agentID,
  cateID,
  agents,
  agentCates,
  disabled = false,
  onChange,
}: {
  agentID?: number
  cateID?: number
  agents: AgentOption[]
  agentCates: AgentCateOption[]
  disabled?: boolean
  onChange: (value: { agentID: number; cateID: number }) => void
}) {
  const selectedAgent = agents.find((agent) => agent.id === agentID)
  const visibleAgentCates = agentCates.length
    ? agentCates
    : deriveAgentCateOptions(agents)
  const selectedCateID = String(
    selectedAgent?.cate_id || cateID || visibleAgentCates[0]?.id || ''
  )
  const filteredAgents = selectedCateID
    ? agents.filter((agent) => String(agent.cate_id || '') === selectedCateID)
    : agents

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={selectedCateID || undefined}
        disabled={disabled}
        onValueChange={(value) => {
          const currentAgent = agents.find((agent) => agent.id === agentID)
          const keepAgent =
            currentAgent && String(currentAgent.cate_id || '') === String(value)
          onChange({
            agentID: keepAgent ? Number(agentID || 0) : 0,
            cateID: Number(value),
          })
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择分类" />
        </SelectTrigger>
        <SelectContent>
          {visibleAgentCates.map((cate) => (
            <SelectItem key={cate.id} value={String(cate.id)}>
              {agentCateLabel(cate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={agentID ? String(agentID) : undefined}
        disabled={disabled}
        onValueChange={(value) => {
          const agent = agents.find((item) => String(item.id) === value)
          onChange({
            agentID: Number(value),
            cateID: Number(agent?.cate_id || selectedCateID || 0),
          })
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择智能体" />
        </SelectTrigger>
        <SelectContent>
          {filteredAgents.map((agent) => (
            <SelectItem key={agent.id} value={String(agent.id)}>
              {agent.name || '未命名智能体'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function resolveEditorTitle(selection: Exclude<Selection, null>) {
  if (selection.kind === 'think') {
    return '编辑思维'
  }
  if (selection.kind === 'node') {
    return '编辑节点'
  }
  return selection.kind === 'think_edge' ? '编辑思维关系' : '编辑节点关系'
}

function normalizeNodeTypePatch(node: BrainNode, type: string): Partial<BrainNode> {
  const baseConfig = omitConfigKeys(node.config, [
    'agent_cate_id',
    'power_id',
    'power_key',
    'power_kind',
    'operator',
    'source_key',
    'input_key',
    'value',
    'body_key',
    'content_key',
  ])
  if (type === 'agent') {
    return {
      type,
      config: omitConfigKeys(node.config, [
        'power_id',
        'power_key',
        'power_kind',
        'operator',
        'source_key',
        'input_key',
        'value',
        'body_key',
        'content_key',
      ]),
    }
  }
  if (type === 'power') {
    return {
      type,
      agent_id: 0,
      config: omitConfigKeys(node.config, [
        'agent_cate_id',
        'operator',
        'source_key',
        'input_key',
        'value',
        'body_key',
        'content_key',
      ]),
    }
  }
  if (type === 'condition') {
    return {
      type,
      agent_id: 0,
      config: {
        ...omitConfigKeys(node.config, [
          'agent_cate_id',
          'power_id',
          'power_key',
          'power_kind',
          'body_key',
          'content_key',
        ]),
        operator: normalizeConditionOperator(node.config?.operator),
      },
    }
  }
  if (type === 'save') {
    return {
      type,
      agent_id: 0,
      config: baseConfig,
    }
  }
  return {
    type,
    agent_id: 0,
    config: baseConfig,
  }
}

function agentCateLabel(cate: AgentCateOption) {
  return String(cate.value || cate.name || cate.id)
}

function deriveAgentCateOptions(agents: AgentOption[]) {
  const cateIDs = Array.from(
    new Set(agents.map((agent) => Number(agent.cate_id || 0)).filter(Boolean))
  )
  return cateIDs.map((id) => ({
    id,
    value: `分类${id}`,
  }))
}

function derivePowerKindOptions(powers: PowerOption[]) {
  const labels: Record<string, string> = {
    text: '文本',
    image: '图片',
    video: '视频',
    audio: '音频',
    role: '角色',
    multi: '多模态',
    embeddings: '向量',
    workflow: '工作流',
  }
  const seen = Array.from(new Set(powers.map((power) => power.kind).filter(Boolean)))
  return seen.map((kind) => ({ id: kind, value: labels[kind] || kind }))
}

function normalizeConditionOperator(value: unknown) {
  const operator = String(value || 'exists').trim().toLowerCase()
  return CONDITION_OPERATORS.some((item) => item.id === operator) ? operator : 'exists'
}

function resolveNodeEdgeConditionOptions(
  edge: Pick<NodeEdge, 'from_key'>,
  nodes: BrainNode[],
  edgeConditions: Array<{ id: string; value: string }>
) {
  const fromNode = nodes.find((node) => node.node_key === edge.from_key)
  if (!fromNode) {
    return []
  }
  if (fromNode.type === 'condition') {
    return pickEdgeConditions(edgeConditions, ['passed', 'failed'])
  }
  if (fromNode.type === 'human_approval') {
    return pickEdgeConditions(edgeConditions, ['approved', 'rejected'])
  }
  return []
}

function pickEdgeConditions(
  edgeConditions: Array<{ id: string; value: string }>,
  ids: string[]
) {
  const byID = new Map(edgeConditions.map((item) => [item.id, item]))
  return ids
    .map((id) => byID.get(id))
    .filter((item): item is { id: string; value: string } => !!item)
}

function buildThinkAssistantContext(think: ThinkItem): AssistantPageContext {
  return {
    scope: 'modal',
    route: 'bot/brain/think',
    page: {
      name: '编辑思维',
      title: think.name || think.key,
    },
    form: {
      fields: thinkAssistantFields(think),
      values: collectThinkAssistantValues(think),
    },
  }
}

function thinkAssistantFields(think: ThinkItem) {
  if (isFlowThink(think)) {
    return THINK_ASSISTANT_FIELDS
  }
  return THINK_ASSISTANT_FIELDS.filter((field) => field.path !== 'form.goal')
}

function collectThinkAssistantValues(think: ThinkItem) {
  const values: Record<string, unknown> = {}
  if (think.name) {
    values['form.name'] = think.name
  }
  values['form.type'] = normalizeThinkType(think.type)
  if (isFlowThink(think) && think.goal) {
    values['form.goal'] = think.goal
  }
  return values
}

function applyThinkAssistantValues(
  key: string,
  values: Record<string, unknown>,
  onChangeThink: (key: string, patch: Partial<ThinkItem>) => void
) {
  const patch: Partial<ThinkItem> = {}
  const name = readAssistantTextValue(values, 'form.name')
  const type = readAssistantTextValue(values, 'form.type')
  const goal = readAssistantTextValue(values, 'form.goal')
  const nextType = type !== undefined ? normalizeThinkType(type) : undefined

  if (name !== undefined) {
    patch.name = name
  }
  if (nextType !== undefined) {
    patch.type = nextType
  }
  if (goal !== undefined && nextType === THINK_TYPE_FLOW) {
    patch.goal = goal
  }
  if (Object.keys(patch).length > 0) {
    onChangeThink(key, patch)
  }
}

function readAssistantTextValue(values: Record<string, unknown>, path: string) {
  const shortPath = path.replace(/^form\./, '')
  const value = values[path] ?? values[shortPath]
  if (value === undefined || value === null) {
    return undefined
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4 space-y-2 text-sm">
      <div className="font-medium">{label}</div>
      {children}
    </div>
  )
}

function resolveBrainID() {
  if (typeof window === 'undefined') return 0
  const params = new URLSearchParams(window.location.search)
  return Number(params.get('brain_id') || params.get('id') || 0)
}

function normalizeWorkspace(data: any): WorkspaceData {
  const flowNodes = data?.flow_nodes_by_think ?? data?.nodes_by_think ?? {}
  const flowEdges = data?.flow_edges_by_think ?? data?.edges_by_think ?? {}
  return {
    brain: normalizeBrainData(data?.brain),
    thinks: Array.isArray(data?.thinks) ? data.thinks.map(normalizeThinkItem) : [],
    think_edges: Array.isArray(data?.think_edges) ? data.think_edges : [],
    flow_nodes_by_think: flowNodes,
    flow_edges_by_think: flowEdges,
    nodes_by_think: flowNodes,
    edges_by_think: flowEdges,
    create_powers_by_think: normalizeCreatePowersByThink(data?.create_powers_by_think),
    agents: Array.isArray(data?.agents) ? data.agents : [],
    agent_cates: Array.isArray(data?.agent_cates) ? data.agent_cates : [],
    powers: Array.isArray(data?.powers) ? data.powers : [],
    power_kinds: Array.isArray(data?.power_kinds) ? data.power_kinds : [],
    node_types: Array.isArray(data?.node_types) ? data.node_types : NODE_TYPES,
    edge_conditions: Array.isArray(data?.edge_conditions)
      ? data.edge_conditions
      : EDGE_CONDITIONS,
  }
}

function normalizeBrainData(brain: any) {
  const normalized = brain && typeof brain === 'object' ? { ...brain } : {}
  normalized.publish_status = normalizeBrainPublishStatus(normalized.publish_status)
  normalized.current_release_id = Number(normalized.current_release_id || 0)
  normalized.release_version = Number(normalized.release_version || 0)
  normalized.readonly = Boolean(normalized.readonly) || isBrainReadonly(normalized)
  return normalized
}

function normalizeThinkItem(think: any): ThinkItem {
  return {
    ...think,
    type: normalizeThinkType(think?.type),
  }
}

function normalizeCreatePowersByThink(raw: any) {
  const result: Record<string, ThinkCreatePower[]> = {}
  Object.entries(raw ?? {}).forEach(([key, value]) => {
    result[key] = Array.isArray(value) ? groupCreatePowers(value) : []
  })
  return result
}

function groupCreatePowers(rows: any[]) {
  const grouped = new Map<string, ThinkCreatePower>()
  const sortedRows = [...rows].sort(
    (a, b) => Number(a?.sort || 0) - Number(b?.sort || 0)
  )
  sortedRows.forEach((item: any, index) => {
    const kind = String(item?.kind || '')
    const powerID = Number(item?.power_id || item?.powerId || 0)
    if (!kind) {
      return
    }
    const current = grouped.get(kind)
    if (current) {
      if (powerID && !normalizeCreatePowerIDs(current).includes(powerID)) {
        current.power_ids = [...normalizeCreatePowerIDs(current), powerID]
      }
      current.sort = Math.min(Number(current.sort || 100), Number(item?.sort || 100))
      return
    }
    grouped.set(kind, {
      id: Number(item?.id || 0) || undefined,
      kind,
      power_id: powerID,
      power_ids: powerID ? [powerID] : [],
      status: Number(item?.status || 1),
      sort: Number(item?.sort || (index + 1) * 10),
    })
  })
  return Array.from(grouped.values()).sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
}

function normalizeCreatePowerIDs(item: ThinkCreatePower) {
  const values = Array.isArray(item.power_ids) ? [...item.power_ids] : []
  if (item.power_id) {
    values.unshift(item.power_id)
  }
  return Array.from(new Set(values.map(Number).filter(Boolean)))
}

function normalizeThinkType(value: unknown) {
  const type = String(value ?? '').trim().toLowerCase()
  if (
    type === THINK_TYPE_CREATE ||
    type === '创作' ||
    type === 'free_create' ||
    type === '自由创作'
  ) {
    return THINK_TYPE_CREATE
  }
  return THINK_TYPE_FLOW
}

function normalizeBrainPublishStatus(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase()
  if (status === BRAIN_PUBLISH_PUBLISHED || status === '已发布' || status === '发布') {
    return BRAIN_PUBLISH_PUBLISHED
  }
  if (status === BRAIN_PUBLISH_EDITING || status === '编辑草稿' || status === 'editing_draft') {
    return BRAIN_PUBLISH_EDITING
  }
  return BRAIN_PUBLISH_DRAFT
}

function isBrainReadonly(brain: Record<string, any> | undefined) {
  return Boolean(brain?.readonly) || normalizeBrainPublishStatus(brain?.publish_status) === BRAIN_PUBLISH_PUBLISHED
}

function brainPublishStatusLabel(status: string) {
  if (status === BRAIN_PUBLISH_PUBLISHED) {
    return '已发布'
  }
  if (status === BRAIN_PUBLISH_EDITING) {
    return '编辑草稿'
  }
  return '草稿'
}

function isFlowThink(think: ThinkItem | undefined) {
  return normalizeThinkType(think?.type) === THINK_TYPE_FLOW
}

function isActiveThinkListItem(
  view: ViewMode,
  selectedThinkKey: string,
  think: ThinkItem
) {
  if (view === 'node' || view === 'create') {
    return selectedThinkKey === think.key
  }
  return false
}

function thinkTypeLabel(type: unknown) {
  return THINK_TYPES.find((item) => item.id === normalizeThinkType(type))?.value || '流程'
}

function nodeTypeLabel(type: unknown, nodeTypes: Array<{ id: string; value: string }>) {
  const id = String(type || 'agent')
  return (
    nodeTypes.find((item) => item.id === id)?.value ||
    NODE_TYPES.find((item) => item.id === id)?.value ||
    id
  )
}

function visibleNodeTypes(types: Array<{ id: string; value: string }>) {
  return types.filter((type) => VISIBLE_NODE_TYPE_IDS.has(type.id))
}

function normalizeNodesForSave(nodes: BrainNode[]) {
  return nodes.map((node) => ({
    ...node,
    agent_id: node.type === 'agent' ? node.agent_id : 0,
    config: normalizeNodeConfigForSave(node),
  }))
}

function normalizeCreatePowersForSave(items: ThinkCreatePower[]) {
  return items
    .flatMap((item, index) => {
      if (!item.kind) {
        return []
      }
      const baseSort = item.sort || (index + 1) * 10
      return normalizeCreatePowerIDs(item).map((powerID, powerIndex) => ({
        id: powerIndex === 0 ? item.id : undefined,
        kind: item.kind,
        power_id: powerID,
        status: item.status || 1,
        sort: baseSort + powerIndex,
      }))
    })
}

function normalizeNodeConfigForSave(node: BrainNode) {
  const config = omitConfigKeys(node.config, ['task', 'input_keys', 'output_key'])
  if (node.type === 'agent') {
    return omitConfigKeys(config, [
      'power_id',
      'power_key',
      'power_kind',
      'operator',
      'source_key',
      'input_key',
      'value',
      'body_key',
      'content_key',
    ])
  }
  if (node.type === 'power') {
    return omitConfigKeys(config, [
      'agent_cate_id',
      'operator',
      'source_key',
      'input_key',
      'value',
      'body_key',
      'content_key',
    ])
  }
  if (node.type === 'condition') {
    return {
      ...omitConfigKeys(config, [
        'agent_cate_id',
        'power_id',
        'power_key',
        'power_kind',
        'body_key',
        'content_key',
      ]),
      operator: normalizeConditionOperator(config.operator),
    }
  }
  if (node.type === 'save') {
    return omitConfigKeys(config, [
      'agent_cate_id',
      'power_id',
      'power_key',
      'power_kind',
      'operator',
      'source_key',
      'input_key',
      'value',
      'body_key',
      'content_key',
    ])
  }
  return omitConfigKeys(config, [
    'agent_cate_id',
    'power_id',
    'power_key',
    'power_kind',
    'operator',
    'source_key',
    'input_key',
    'value',
    'body_key',
    'content_key',
  ])
}

function omitConfigKeys(config: Record<string, any> | undefined, keys: string[]) {
  const next = { ...(config ?? {}) }
  keys.forEach((key) => {
    delete next[key]
  })
  return next
}

function addThink(setWorkspace: Dispatch<SetStateAction<WorkspaceData>>) {
  const key = `think_${Date.now()}`
  setWorkspace((current) => ({
    ...current,
    thinks: [
      ...(current.thinks ?? []),
      createThinkItem(current.thinks ?? [], key),
    ],
  }))
}

function addNode(
  thinkKey: string,
  setWorkspace: Dispatch<SetStateAction<WorkspaceData>>
) {
  if (!thinkKey) {
    toast.error('请先选择一个思维')
    return
  }
  const key = `node_${Date.now()}`
  setWorkspace((current) => {
    const nodes = current.nodes_by_think?.[thinkKey] ?? []
    return {
      ...current,
      nodes_by_think: {
        ...(current.nodes_by_think ?? {}),
        [thinkKey]: [
          ...nodes,
          createNodeItem(nodes, key),
        ],
      },
    }
  })
}

function addCreatePower(
  thinkKey: string,
  setWorkspace: Dispatch<SetStateAction<WorkspaceData>>
) {
  if (!thinkKey) {
    toast.error('请先选择一个创作')
    return
  }
  setWorkspace((current) => {
    const items = current.create_powers_by_think?.[thinkKey] ?? []
    const usedKinds = new Set(items.map((item) => item.kind).filter(Boolean))
    const kind =
      current.power_kinds?.find((item) => !usedKinds.has(item.id))?.id ||
      current.powers?.find((item) => !usedKinds.has(item.kind))?.kind ||
      current.power_kinds?.[0]?.id ||
      current.powers?.[0]?.kind ||
      'text'
    const power = current.powers?.find((item) => item.kind === kind)
    return {
      ...current,
      create_powers_by_think: {
        ...(current.create_powers_by_think ?? {}),
        [thinkKey]: [
          ...items,
          {
            kind,
            power_id: power?.id || 0,
            power_ids: power?.id ? [power.id] : [],
            status: 1,
            sort: (items.length + 1) * 10,
          },
        ],
      },
    }
  })
}

function createThinkItem(
  thinks: ThinkItem[],
  key: string,
  position?: CanvasPoint
): ThinkItem {
  return {
    key,
    name: nextIndexedName('思维', thinks, (think) => think.name),
    type: THINK_TYPE_CREATE,
    goal: '',
    position: position ?? defaultGraphPosition(thinks.length),
    status: 1,
    sort: (thinks.length + 1) * 10,
  }
}

function createNodeItem(
  nodes: BrainNode[],
  key: string,
  position?: CanvasPoint
): BrainNode {
  return {
    node_key: key,
    name: nextIndexedName('节点', nodes, (node) => node.name),
    type: 'agent',
    agent_id: 0,
    config: {},
    position: position ?? defaultGraphPosition(nodes.length),
    status: 1,
    sort: (nodes.length + 1) * 10,
  }
}

function defaultGraphPosition(index: number) {
  return {
    x: 90 + (index % 4) * 280,
    y: 90 + Math.floor(index / 4) * 180,
  }
}

function nextIndexedName<T>(
  prefix: string,
  rows: T[],
  getName: (row: T) => string
) {
  const used = new Set<number>()
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`)
  rows.forEach((row) => {
    const match = String(getName(row) || '').trim().match(pattern)
    if (match) {
      used.add(Number(match[1]))
    }
  })

  let index = 1
  while (used.has(index)) {
    index += 1
  }
  return `${prefix}${index}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addThinkEdge(workspace: WorkspaceData, fromKey: string, toKey: string): WorkspaceData {
  if (fromKey === toKey || (workspace.think_edges ?? []).some((edge) => edge.from_key === fromKey && edge.to_key === toKey)) {
    return workspace
  }
  return {
    ...workspace,
    think_edges: [
      ...(workspace.think_edges ?? []),
      {
        from_key: fromKey,
        to_key: toKey,
        condition: 'completed',
        input_mapping: {},
        status: 1,
        sort: ((workspace.think_edges?.length ?? 0) + 1) * 10,
      },
    ],
  }
}

function addConnectedThink(
  workspace: WorkspaceData,
  fromKey: string,
  key: string,
  position: CanvasPoint
) {
  const thinks = workspace.thinks ?? []
  if (thinks.some((think) => think.key === key)) {
    return workspace
  }
  return addThinkEdge(
    {
      ...workspace,
      thinks: [...thinks, createThinkItem(thinks, key, position)],
    },
    fromKey,
    key
  )
}

function addNodeEdge(
  workspace: WorkspaceData,
  thinkKey: string,
  fromKey: string,
  toKey: string
): WorkspaceData {
  const edges = workspace.edges_by_think?.[thinkKey] ?? []
  if (fromKey === toKey || edges.some((edge) => edge.from_key === fromKey && edge.to_key === toKey)) {
    return workspace
  }
  const nodes = workspace.nodes_by_think?.[thinkKey] ?? []
  const fromNode = nodes.find((node) => node.node_key === fromKey)
  return {
    ...workspace,
    edges_by_think: {
      ...(workspace.edges_by_think ?? {}),
      [thinkKey]: [
        ...edges,
        {
          from_key: fromKey,
          to_key: toKey,
          condition: defaultNodeEdgeCondition(fromNode?.type, edges, fromKey),
          input_mapping: {},
          status: 1,
          sort: (edges.length + 1) * 10,
        },
      ],
    },
  }
}

function addConnectedNode(
  workspace: WorkspaceData,
  thinkKey: string,
  fromKey: string,
  key: string,
  position: CanvasPoint
) {
  const nodes = workspace.nodes_by_think?.[thinkKey] ?? []
  if (nodes.some((node) => node.node_key === key)) {
    return workspace
  }
  return addNodeEdge(
    {
      ...workspace,
      nodes_by_think: {
        ...(workspace.nodes_by_think ?? {}),
        [thinkKey]: [...nodes, createNodeItem(nodes, key, position)],
      },
    },
    thinkKey,
    fromKey,
    key
  )
}

function defaultNodeEdgeCondition(
  fromNodeType: string | undefined,
  edges: NodeEdge[],
  fromKey: string
) {
  const outgoing = new Set(
    edges
      .filter((edge) => edge.from_key === fromKey)
      .map((edge) => String(edge.condition || ''))
  )
  if (fromNodeType === 'condition') {
    return outgoing.has('passed') ? 'failed' : 'passed'
  }
  if (fromNodeType === 'human_approval') {
    return outgoing.has('approved') ? 'rejected' : 'approved'
  }
  return 'always'
}

function updateThink(workspace: WorkspaceData, key: string, patch: Partial<ThinkItem>): WorkspaceData {
  return {
    ...workspace,
    thinks: (workspace.thinks ?? []).map((think) =>
      think.key === key ? { ...think, ...patch } : think
    ),
  }
}

function reorderThinks(workspace: WorkspaceData, fromKey: string, toKey: string): WorkspaceData {
  const thinks = [...(workspace.thinks ?? [])]
  const fromIndex = thinks.findIndex((think) => think.key === fromKey)
  const toIndex = thinks.findIndex((think) => think.key === toKey)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return workspace
  }
  const [moved] = thinks.splice(fromIndex, 1)
  thinks.splice(toIndex, 0, moved)
  return {
    ...workspace,
    thinks: thinks.map((think, index) => ({
      ...think,
      sort: (index + 1) * 10,
    })),
  }
}

function updateThinkConfig(
  workspace: WorkspaceData,
  key: string,
  patch: Record<string, any>
): WorkspaceData {
  return updateThink(workspace, key, {
    config: {
      ...((workspace.thinks ?? []).find((think) => think.key === key)?.config ?? {}),
      ...patch,
    },
  })
}

function updateNode(
  workspace: WorkspaceData,
  thinkKey: string,
  key: string,
  patch: Partial<BrainNode>
): WorkspaceData {
  const nodes = workspace.nodes_by_think?.[thinkKey] ?? []
  return {
    ...workspace,
    nodes_by_think: {
      ...(workspace.nodes_by_think ?? {}),
      [thinkKey]: nodes.map((node) =>
        node.node_key === key ? { ...node, ...patch } : node
      ),
    },
  }
}

function updateNodeEdge(
  workspace: WorkspaceData,
  thinkKey: string,
  index: number,
  patch: Partial<NodeEdge>
): WorkspaceData {
  const edges = workspace.edges_by_think?.[thinkKey] ?? []
  return {
    ...workspace,
    edges_by_think: {
      ...(workspace.edges_by_think ?? {}),
      [thinkKey]: edges.map((edge, currentIndex) =>
        currentIndex === index ? { ...edge, ...patch } : edge
      ),
    },
  }
}

function updateCreatePower(
  workspace: WorkspaceData,
  thinkKey: string,
  index: number,
  patch: Partial<ThinkCreatePower>
): WorkspaceData {
  const items = workspace.create_powers_by_think?.[thinkKey] ?? []
  return {
    ...workspace,
    create_powers_by_think: {
      ...(workspace.create_powers_by_think ?? {}),
      [thinkKey]: items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item
      ),
    },
  }
}

function reorderCreatePowers(
  workspace: WorkspaceData,
  thinkKey: string,
  fromIndex: number,
  toIndex: number
): WorkspaceData {
  const items = [...(workspace.create_powers_by_think?.[thinkKey] ?? [])]
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return workspace
  }
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)
  return {
    ...workspace,
    create_powers_by_think: {
      ...(workspace.create_powers_by_think ?? {}),
      [thinkKey]: items.map((item, index) => ({
        ...item,
        sort: (index + 1) * 10,
      })),
    },
  }
}

function removeCreatePower(
  workspace: WorkspaceData,
  thinkKey: string,
  index: number
): WorkspaceData {
  const items = workspace.create_powers_by_think?.[thinkKey] ?? []
  return {
    ...workspace,
    create_powers_by_think: {
      ...(workspace.create_powers_by_think ?? {}),
      [thinkKey]: items.filter((_item, currentIndex) => currentIndex !== index),
    },
  }
}

function removeGraphSelection(
  workspace: WorkspaceData,
  selection: Exclude<Selection, null>,
  thinkKey: string
): WorkspaceData {
  if (selection.kind === 'think') {
    const nodesByThink = { ...(workspace.nodes_by_think ?? {}) }
    const edgesByThink = { ...(workspace.edges_by_think ?? {}) }
    const flowNodesByThink = { ...(workspace.flow_nodes_by_think ?? {}) }
    const flowEdgesByThink = { ...(workspace.flow_edges_by_think ?? {}) }
    const createPowersByThink = { ...(workspace.create_powers_by_think ?? {}) }
    delete nodesByThink[selection.key]
    delete edgesByThink[selection.key]
    delete flowNodesByThink[selection.key]
    delete flowEdgesByThink[selection.key]
    delete createPowersByThink[selection.key]
    return {
      ...workspace,
      thinks: (workspace.thinks ?? []).filter((think) => think.key !== selection.key),
      think_edges: (workspace.think_edges ?? []).filter(
        (edge) => edge.from_key !== selection.key && edge.to_key !== selection.key
      ),
      flow_nodes_by_think: flowNodesByThink,
      flow_edges_by_think: flowEdgesByThink,
      nodes_by_think: nodesByThink,
      edges_by_think: edgesByThink,
      create_powers_by_think: createPowersByThink,
    }
  }

  if (selection.kind === 'think_edge') {
    return {
      ...workspace,
      think_edges: (workspace.think_edges ?? []).filter(
        (_edge, index) => index !== selection.index
      ),
    }
  }

  if (selection.kind === 'node') {
    const nodes = workspace.nodes_by_think?.[thinkKey] ?? []
    const edges = workspace.edges_by_think?.[thinkKey] ?? []
    return {
      ...workspace,
      nodes_by_think: {
        ...(workspace.nodes_by_think ?? {}),
        [thinkKey]: nodes.filter((node) => node.node_key !== selection.key),
      },
      edges_by_think: {
        ...(workspace.edges_by_think ?? {}),
        [thinkKey]: edges.filter(
          (edge) => edge.from_key !== selection.key && edge.to_key !== selection.key
        ),
      },
    }
  }

  const edges = workspace.edges_by_think?.[thinkKey] ?? []
  return {
    ...workspace,
    edges_by_think: {
      ...(workspace.edges_by_think ?? {}),
      [thinkKey]: edges.filter((_edge, index) => index !== selection.index),
    },
  }
}
