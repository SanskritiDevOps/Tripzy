// Minimal dnd-kit modifiers (avoids pulling in @dnd-kit/modifiers for two helpers).

export function restrictToVerticalAxis({ transform }) {
  return { ...transform, x: 0 }
}

export function restrictToParentElement({ containerNodeRect, draggingNodeRect, transform }) {
  if (!draggingNodeRect || !containerNodeRect) return transform
  const minY = containerNodeRect.top - draggingNodeRect.top
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom
  return { ...transform, y: Math.min(Math.max(transform.y, minY), maxY) }
}
