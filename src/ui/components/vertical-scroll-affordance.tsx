import * as React from 'react'
import { Button } from './ui/button'
import { ChevronUp, ChevronDown } from 'lucide-react'

type Props = {
  scrollRef: React.RefObject<HTMLElement | HTMLDivElement>
  className?: string
}

export function VerticalScrollAffordance({ scrollRef }: Props) {
  const [canUp, setCanUp] = React.useState(false)
  const [canDown, setCanDown] = React.useState(false)

  React.useEffect(() => {
    const el = scrollRef.current as HTMLElement | null
    if (!el) return
    const onScroll = () => {
      setCanUp(el.scrollTop > 0)
      setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
    }
    onScroll()
    el.addEventListener('scroll', onScroll)
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [scrollRef])

  function scrollToEdge(edge: 'top' | 'bottom') {
    const el = scrollRef.current as HTMLElement | null
    if (!el) return
    const top = edge === 'top' ? 0 : el.scrollHeight - el.clientHeight
    el.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <>
      {canUp && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-2 h-7 w-7 shadow-sm bg-background/70"
          onClick={() => scrollToEdge('top')}
          title="Scroll up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}
      {canDown && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 bottom-2 h-7 w-7 shadow-sm bg-background/70"
          onClick={() => scrollToEdge('bottom')}
          title="Scroll down"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </>
  )}


