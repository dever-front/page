import { useMemo, useState } from 'react'
import { ChevronRight, FolderOpen, Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type TreeNode = {
  id: string | number
  value?: string
  children?: TreeNode[]
  [key: string]: any
}

type TreeIndex = {
  descendants: Map<string, string[]>
  parents: Map<string, string>
}

type TreeMode = 'tree' | 'detail'

type ToggleNode = (value: string, checked: boolean) => void

type TreeControls = {
  selected: Set<string>
  labelField: string
  childrenField: string
  onToggle: ToggleNode
}

export function FormTree({ item, value, setValue, option, optionLoading, error }: NodeItemProps) {
  const labelField = String(item.meta?.labelField || 'value')
  const childrenField = String(item.meta?.childrenField || 'children')
  const mode = getTreeMode(item.meta?.leafLayout)
  const checkedIds = useMemo(
    () => toIdList(value),
    [value]
  )
  const [keyword, setKeyword] = useState('')
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)

  const tree = useMemo(
    () => toTree(Array.isArray(option) ? option : [], childrenField),
    [childrenField, option]
  )

  const index = useMemo(
    () => buildTreeIndex(tree, childrenField),
    [childrenField, tree]
  )

  const selected = useMemo(
    () => includeParentIds(checkedIds, index.parents),
    [checkedIds, index.parents]
  )

  const filteredTree = useMemo(
    () => filterTree(tree, keyword, labelField, childrenField),
    [childrenField, keyword, labelField, tree]
  )

  const toggleNode = (nodeValue: string, checked: boolean) => {
    if (checked) {
      setValue(Array.from(new Set([...checkedIds, nodeValue])))
      return
    }

    const removableIds = new Set([
      nodeValue,
      ...(index.descendants.get(nodeValue) || []),
    ])
    const remainingSelected = checkedIds.filter((current) => !removableIds.has(current))
    setValue(remainingSelected)
  }

  return (
    <div
      className={cn(
        'w-full space-y-3 rounded-xl border border-input/80 bg-background p-3 shadow-xs',
        error && 'border-destructive/60',
        item.meta?.controlClassName
      )}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={item.placeholder || '输入关键字进行过滤'}
          className="pl-9"
        />
      </div>

      <div
        className={cn(
          'max-h-[360px] rounded-lg border bg-muted/10',
          mode === 'detail' ? 'overflow-hidden' : 'overflow-auto',
          item.meta?.treeClassName
        )}
      >
        {filteredTree.length > 0 ? (
          <div className={cn('p-2', mode === 'detail' && 'p-0')}>
            {mode === 'detail' ? (
              <DetailTree
                nodes={filteredTree}
                activeNodeId={activeNodeId}
                selected={selected}
                labelField={labelField}
                childrenField={childrenField}
                onActiveChange={setActiveNodeId}
                onToggle={toggleNode}
              />
            ) : (
              <TreeNodeList
                nodes={filteredTree}
                depth={0}
                selected={selected}
                labelField={labelField}
                childrenField={childrenField}
                onToggle={toggleNode}
              />
            )}
          </div>
        ) : optionLoading ? (
          <div className="p-6 text-sm text-muted-foreground">正在加载可选项...</div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">暂无可选权限</div>
        )}
      </div>
    </div>
  )
}

function TreeNodeRow({
  node,
  depth,
  selected,
  labelField,
  childrenField,
  onToggle,
}: {
  node: TreeNode
  depth: number
} & TreeControls) {
  const [open, setOpen] = useState(true)
  const value = nodeId(node)
  const label = nodeLabel(node, labelField)
  const children = getNodeChildren(node, childrenField)
  const hasChildren = children.length > 0

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent"
          >
            <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="inline-flex size-5 items-center justify-center text-muted-foreground">
            <FolderOpen className="size-4 opacity-60" />
          </span>
        )}

        <Checkbox
          checked={selected.has(value)}
          onCheckedChange={(checked) => onToggle(value, checked === true)}
        />
        <span className="truncate text-sm text-foreground">{label}</span>
      </div>

      {hasChildren && open ? (
        <TreeNodeList
          nodes={children}
          depth={depth + 1}
          selected={selected}
          labelField={labelField}
          childrenField={childrenField}
          onToggle={onToggle}
        />
      ) : null}
    </div>
  )
}

function TreeNodeList({
  nodes,
  depth,
  selected,
  labelField,
  childrenField,
  onToggle,
}: {
  nodes: TreeNode[]
  depth: number
} & TreeControls) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNodeRow
          key={nodeId(node)}
          node={node}
          depth={depth}
          selected={selected}
          labelField={labelField}
          childrenField={childrenField}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function DetailTree({
  nodes,
  activeNodeId,
  selected,
  labelField,
  childrenField,
  onActiveChange,
  onToggle,
}: {
  nodes: TreeNode[]
  activeNodeId: string | null
  onActiveChange: (id: string) => void
} & TreeControls) {
  const activeNode = activeNodeId
    ? findNode(
        nodes,
        childrenField,
        (node) => nodeId(node) === activeNodeId && isLeftNode(node, childrenField)
      )
    : null
  const currentNode =
    activeNode ?? findNode(nodes, childrenField, (node) => isLeftNode(node, childrenField))

  return (
    <div className="grid h-[60vh] min-h-[420px] grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] overflow-hidden">
      <div className="overflow-y-auto border-r bg-muted/20 p-2">
        <LeftTree
          nodes={nodes}
          depth={0}
          activeNodeId={currentNode ? nodeId(currentNode) : ''}
          selected={selected}
          labelField={labelField}
          childrenField={childrenField}
          onActiveChange={onActiveChange}
          onToggle={onToggle}
        />
      </div>
      <div className="min-w-0 overflow-y-auto p-4">
        {currentNode ? (
          <RightPanel
            node={currentNode}
            selected={selected}
            labelField={labelField}
            childrenField={childrenField}
            onToggle={onToggle}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            请选择左侧模块查看权限。
          </div>
        )}
      </div>
    </div>
  )
}

function LeftTree({
  nodes,
  depth,
  activeNodeId,
  selected,
  labelField,
  childrenField,
  onActiveChange,
  onToggle,
}: {
  nodes: TreeNode[]
  depth: number
  activeNodeId: string
  onActiveChange: (id: string) => void
} & TreeControls) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => {
        const children = getNodeChildren(node, childrenField)
        if (!isLeftNode(node, childrenField)) {
          return null
        }

        const value = nodeId(node)
        const label = nodeLabel(node, labelField)
        const active = value === activeNodeId

        return (
          <div key={value} className="space-y-1">
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-accent/60',
                active && 'bg-accent text-accent-foreground'
              )}
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
            >
              <Checkbox
                checked={selected.has(value)}
                onCheckedChange={(checked) => onToggle(value, checked === true)}
              />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onActiveChange(value)}
              >
                {label}
              </button>
            </div>
            <LeftTree
              nodes={children}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              selected={selected}
              labelField={labelField}
              childrenField={childrenField}
              onActiveChange={onActiveChange}
              onToggle={onToggle}
            />
          </div>
        )
      })}
    </div>
  )
}

function RightPanel({
  node,
  selected,
  labelField,
  childrenField,
  onToggle,
}: {
  node: TreeNode
} & TreeControls) {
  const value = nodeId(node)
  const label = nodeLabel(node, labelField)
  const leaves = directLeaves(node, childrenField)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">
            页面访问与该模块下的操作权限集中维护。
          </div>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent/60">
          <Checkbox
            checked={selected.has(value)}
            onCheckedChange={(checked) => onToggle(value, checked === true)}
          />
          页面访问
        </label>
      </div>

      {leaves.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">菜单下权限</div>
          <LeafGrid
            nodes={leaves}
            selected={selected}
            labelField={labelField}
            onToggle={onToggle}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          这个菜单下暂无独立操作权限。
        </div>
      )}
    </div>
  )
}

function LeafGrid({
  nodes,
  selected,
  labelField,
  onToggle,
}: {
  nodes: TreeNode[]
  selected: Set<string>
  labelField: string
  onToggle: ToggleNode
}) {
  return (
    <div className="flex flex-wrap gap-2 py-1">
      {nodes.map((node) => {
        const value = nodeId(node)
        const label = nodeLabel(node, labelField)

        return (
          <label
            key={value}
            className="inline-flex min-h-8 max-w-[16rem] cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm transition hover:bg-accent/60"
          >
            <Checkbox
              checked={selected.has(value)}
              onCheckedChange={(checked) => onToggle(value, checked === true)}
            />
            <span className="truncate text-foreground">{label}</span>
          </label>
        )
      })}
    </div>
  )
}

function getTreeMode(value: unknown): TreeMode {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'detail':
    case 'split':
      return 'detail'
    default:
      return 'tree'
  }
}

function findNode(
  nodes: TreeNode[],
  childrenField: string,
  match: (node: TreeNode) => boolean
): TreeNode | null {
  for (const node of nodes) {
    if (match(node)) {
      return node
    }
    const childResult = findNode(getNodeChildren(node, childrenField), childrenField, match)
    if (childResult) {
      return childResult
    }
  }
  return null
}

function directLeaves(node: TreeNode, childrenField: string): TreeNode[] {
  return getNodeChildren(node, childrenField).filter(
    (child) => getNodeChildren(child, childrenField).length === 0
  )
}

function hasLeafDescendant(node: TreeNode, childrenField: string): boolean {
  return getNodeChildren(node, childrenField).some((child) => {
    const children = getNodeChildren(child, childrenField)
    return children.length === 0 || hasLeafDescendant(child, childrenField)
  })
}

function isLeftNode(node: TreeNode, childrenField: string) {
  return isMenuNode(node, childrenField) || hasLeafDescendant(node, childrenField)
}

function isMenuNode(node: TreeNode, childrenField: string) {
  if (node.type != null && String(node.type).trim() !== '') {
    return Number(node.type) === 1
  }
  return getNodeChildren(node, childrenField).length > 0
}

function nodeId(node: TreeNode) {
  return String(node.id)
}

function nodeLabel(node: TreeNode, labelField: string) {
  return String(node[labelField] ?? node.value ?? node.id)
}

function getNodeChildren(node: TreeNode, childrenField: string): TreeNode[] {
  return Array.isArray(node[childrenField]) ? node[childrenField] : []
}

function toTree(option: any[], childrenField: string): TreeNode[] {
  const directChildren = option.some(
    (item) => item && typeof item === 'object' && Array.isArray(item[childrenField])
  )
  if (directChildren) {
    return option as TreeNode[]
  }

  const byId = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  option.forEach((item) => {
    const node: TreeNode = {
      ...item,
      [childrenField]: [],
    }
    byId.set(String(item.id), node)
  })

  option.forEach((item) => {
    const node = byId.get(String(item.id))
    if (!node) return
    const parentId = item.parent_id
    if (parentId == null || parentId === '' || String(parentId) === '0') {
      roots.push(node)
      return
    }
    const parent = byId.get(String(parentId))
    if (!parent) {
      roots.push(node)
      return
    }
    parent[childrenField].push(node)
  })

  return roots
}

function buildTreeIndex(nodes: TreeNode[], childrenField: string): TreeIndex {
  const parents = new Map<string, string>()
  const descendants = new Map<string, string[]>()

  const walk = (items: TreeNode[], parentId?: string) => {
    for (const node of items) {
      const id = nodeId(node)
      if (parentId) {
        parents.set(id, parentId)
      }

      const children = getNodeChildren(node, childrenField)
      walk(children, id)

      const nodeDescendants: string[] = []
      for (const child of children) {
        const childId = nodeId(child)
        nodeDescendants.push(childId)
        nodeDescendants.push(...(descendants.get(childId) || []))
      }
      descendants.set(id, nodeDescendants)
    }
  }

  walk(nodes)
  return { descendants, parents }
}

function toIdList(value: any) {
  if (Array.isArray(value)) {
    return value
      .filter((current) => current != null && current !== '')
      .map((current) => String(current))
  }
  if (value == null || value === '') {
    return []
  }
  return [String(value)]
}

function includeParentIds(
  values: string[],
  parentById: Map<string, string>
) {
  const selected = new Set(values)

  for (const value of values) {
    let current = parentById.get(value)
    while (current) {
      if (selected.has(current)) {
        break
      }
      selected.add(current)
      current = parentById.get(current)
    }
  }

  return selected
}

function filterTree(
  nodes: TreeNode[],
  keyword: string,
  labelField: string,
  childrenField: string
): TreeNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return nodes
  }

  const result: TreeNode[] = []
  for (const node of nodes) {
    const children = getNodeChildren(node, childrenField)
    const nextChildren = filterTree(children, keyword, labelField, childrenField)
    const label = nodeLabel(node, labelField).toLowerCase()
    if (label.includes(normalizedKeyword) || nextChildren.length > 0) {
      result.push({
        ...node,
        [childrenField]: nextChildren,
      })
    }
  }
  return result
}
