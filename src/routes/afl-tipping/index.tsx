import {createFileRoute} from '@tanstack/react-router'
import {AflPersistenceProvider} from "~/features/afl-tipping/providers/afl-persistance-provider";

export const Route = createFileRoute('/afl-tipping/')({
    component: RouteComponent,
})

function RouteComponent() {

    return (
        <AflPersistenceProvider>
            <Outlet />
        </AflPersistenceProvider>
    )
}
