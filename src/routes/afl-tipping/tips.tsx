import { createFileRoute } from '@tanstack/react-router'
import {Tips} from "~/pages/afl-tipping/tips";

export const Route = createFileRoute('/afl-tipping/tips')({
  component: TipsRouteComponent,
})

function TipsRouteComponent() {
  return <Tips />
}
