import { useOutletContext } from 'react-router-dom'

/** Data the trip workspace layout passes to each tab via <Outlet context>. */
export function useTripContext() {
  return useOutletContext()
}
