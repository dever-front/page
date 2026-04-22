import { ShowSelect, type ShowSelectProps } from './select'

export function ShowStatus(props: ShowSelectProps) {
  return (
    <ShowSelect
      {...props}
      item={{
        ...props.item,
        meta: {
          display: 'badge',
          ...(props.item.meta || {}),
        },
      }}
      selectOptions={props.selectOptions}
    />
  )
}
