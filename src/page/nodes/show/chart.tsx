import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { NodeItemProps } from '../../nodes'

type ChartMeta = {
  title?: string
  description?: string
  type?: 'bar' | 'line' | 'area' | 'pie'
  nameKey?: string
  dataKey?: string
  height?: number
}

type ChartRow = Record<string, unknown>

const chartColors = [
  'var(--primary)',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
]

export function ShowChart({ item, value }: NodeItemProps) {
  const meta = (item.meta ?? {}) as ChartMeta
  const rows = normalizeChartRows(value)
  const type = meta.type || 'bar'
  const nameKey = meta.nameKey || 'name'
  const dataKey = meta.dataKey || 'value'
  const height = Number(meta.height || 300)

  return (
    <Card className={cn('min-w-0', item.className)}>
      {meta.title || meta.description ? (
        <CardHeader>
          {meta.title ? <CardTitle>{meta.title}</CardTitle> : null}
          {meta.description ? (
            <CardDescription>{meta.description}</CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent>
        {rows.length ? (
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(type, rows, nameKey, dataKey)}
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"
            style={{ height }}
          >
            暂无统计数据
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function renderChart(
  type: NonNullable<ChartMeta['type']>,
  rows: ChartRow[],
  nameKey: string,
  dataKey: string
) {
  switch (type) {
    case 'pie':
      return (
        <PieChart>
          <Tooltip />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
          />
          <Pie
            data={rows}
            dataKey={dataKey}
            nameKey={nameKey}
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={3}
          >
            {rows.map((row, index) => (
              <Cell
                key={`${String(row[nameKey] ?? index)}-${index}`}
                fill={resolveRowColor(row, index)}
              />
            ))}
          </Pie>
        </PieChart>
      )
    case 'line':
      return (
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      )
    case 'area':
      return (
        <AreaChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.16}
            strokeWidth={2}
          />
        </AreaChart>
      )
    case 'bar':
    default:
      return (
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <Tooltip />
          <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
            {rows.map((row, index) => (
              <Cell
                key={`${String(row[nameKey] ?? index)}-${index}`}
                fill={resolveRowColor(row, index)}
              />
            ))}
          </Bar>
        </BarChart>
      )
  }
}

function normalizeChartRows(value: unknown): ChartRow[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (item): item is ChartRow =>
      !!item && typeof item === 'object' && !Array.isArray(item)
  )
}

function resolveRowColor(row: ChartRow, index: number) {
  const color = String(row.color ?? '').trim()
  return color || chartColors[index % chartColors.length]
}
