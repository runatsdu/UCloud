package dk.sdu.cloud.share.http

import dk.sdu.cloud.calls.client.AuthenticatedClient
import dk.sdu.cloud.calls.client.bearerAuth
import dk.sdu.cloud.calls.client.withoutAuthentication
import dk.sdu.cloud.calls.server.RpcServer
import dk.sdu.cloud.calls.server.bearer
import dk.sdu.cloud.calls.server.securityPrincipal
import dk.sdu.cloud.service.Controller
import dk.sdu.cloud.service.Loggable
import dk.sdu.cloud.share.api.Shares
import dk.sdu.cloud.share.services.ShareQueryService
import dk.sdu.cloud.share.services.ShareService

class ShareController(
    private val shareService: ShareService,
    private val shareQueryService: ShareQueryService,
    private val serviceClient: AuthenticatedClient
) : Controller {
    private val clientAndBackend = serviceClient.withoutAuthentication()

    override fun configure(rpcServer: RpcServer) = with(rpcServer) {
        implement(Shares.create) {
            val bearer = ctx.bearer!!
            shareService.create(
                ctx.securityPrincipal.username,
                request,
                bearer,
                clientAndBackend.bearerAuth(bearer)
            )

            ok(Unit)
        }

        implement(Shares.accept) {
            val bearer = ctx.bearer!!
            shareService.acceptShare(
                ctx.securityPrincipal.username,
                request.path,
                bearer
            )

            ok(Unit)
        }

        implement(Shares.revoke) {
            shareService.deleteShare(
                ctx.securityPrincipal.username,
                request.path,
                request.sharedWith
            )

            ok(Unit)
        }

        implement(Shares.update) {
            shareService.updateRights(
                ctx.securityPrincipal.username,
                request.path,
                request.sharedWith,
                request.rights
            )

            ok(Unit)
        }

        implement(Shares.list) {
            ok(
                shareQueryService.list(
                    ctx.securityPrincipal.username,
                    request.sharedByMe,
                    request.normalize()
                )
            )
        }

        implement(Shares.findByPath) {
            ok(
                shareQueryService.findSharesForPath(
                    ctx.securityPrincipal.username,
                    request.path,
                    ctx.bearer!!
                )
            )
        }

        implement(Shares.listFiles) {
            ok(
                shareQueryService.listFiles(
                    ctx.securityPrincipal.username,
                    request.normalize(),
                    ctx.bearer!!
                )
            )
        }
    }

    companion object : Loggable {
        override val log = logger()
    }
}
