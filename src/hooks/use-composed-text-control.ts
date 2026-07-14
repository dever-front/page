import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
} from 'react'

type TextControlElement = HTMLInputElement | HTMLTextAreaElement

export function useComposedTextControl<T extends TextControlElement>(
  value: unknown,
  onValueChange: (value: string) => void
) {
  const externalValue = String(value ?? '')
  const [draftValue, setDraftValue] = useState(externalValue)
  const [isComposing, setIsComposing] = useState(false)
  const composingRef = useRef(false)
  const committedValueRef = useRef(externalValue)

  useEffect(() => {
    committedValueRef.current = externalValue
  }, [externalValue])

  const commitValue = (nextValue: string) => {
    if (nextValue === committedValueRef.current) {
      return
    }
    committedValueRef.current = nextValue
    onValueChange(nextValue)
  }

  const handleChange = (event: ChangeEvent<T>) => {
    const nextValue = event.currentTarget.value
    if (
      composingRef.current ||
      Boolean((event.nativeEvent as InputEvent).isComposing)
    ) {
      composingRef.current = true
      setIsComposing(true)
      setDraftValue(nextValue)
      return
    }
    commitValue(nextValue)
  }

  const handleCompositionStart = (event: CompositionEvent<T>) => {
    composingRef.current = true
    setIsComposing(true)
    setDraftValue(event.currentTarget.value)
  }

  const handleCompositionEnd = (event: CompositionEvent<T>) => {
    const nextValue = event.currentTarget.value
    composingRef.current = false
    setIsComposing(false)
    setDraftValue(nextValue)
    commitValue(nextValue)
  }

  return {
    value: isComposing ? draftValue : externalValue,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  }
}
