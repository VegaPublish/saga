import Composer from './Composer'
import debug from '../debug'

export default function plan(rootNode, globalFilter) {
  const composer = new Composer(rootNode)
  if (globalFilter) {
    debug("The Global Filter Yay!")
    composer.applyGlobalFilter(globalFilter)
  }
  return composer.result()
}
