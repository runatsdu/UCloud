package dk.sdu.cloud.accounting.storage.http

import dk.sdu.cloud.accounting.api.UsageResponse
import dk.sdu.cloud.accounting.storage.api.StorageUsedResourceDescription
import dk.sdu.cloud.accounting.storage.services.StorageAccountingService
import dk.sdu.cloud.calls.server.RpcServer
import dk.sdu.cloud.calls.server.project
import dk.sdu.cloud.calls.server.securityPrincipal
import dk.sdu.cloud.service.Controller

class StorageUsedController(
    private val storageAccountingService: StorageAccountingService
) : Controller {
    override fun configure(rpcServer: RpcServer) = with(rpcServer) {
        implement(StorageUsedResourceDescription.usage) {
            val homeFolder = if (ctx.project == null) {
                "/home/${ctx.securityPrincipal.username}"
            } else {
                "/projects/${ctx.project}"
            }

            val usage = storageAccountingService.calculateUsage(ctx.securityPrincipal.username, homeFolder)

            ok(
                UsageResponse(
                    usage = usage,
                    dataType = "bytes",
                    title = "Storage Used",
                    quota = null
                )
            )
        }
    }
}
