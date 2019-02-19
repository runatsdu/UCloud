package dk.sdu.cloud.file.gateway.http

import dk.sdu.cloud.calls.client.call
import dk.sdu.cloud.calls.client.orThrow
import dk.sdu.cloud.calls.server.HttpCall
import dk.sdu.cloud.calls.server.RpcServer
import dk.sdu.cloud.file.api.FileDescriptions
import dk.sdu.cloud.file.api.FindByPath
import dk.sdu.cloud.file.api.ListDirectoryRequest
import dk.sdu.cloud.file.api.LookupFileInDirectoryRequest
import dk.sdu.cloud.file.gateway.api.FileGatewayDescriptions
import dk.sdu.cloud.file.gateway.api.resourcesToLoad
import dk.sdu.cloud.file.gateway.services.FileAnnotationService
import dk.sdu.cloud.file.gateway.services.UserCloudService
import dk.sdu.cloud.file.gateway.services.withNewItems
import dk.sdu.cloud.service.Controller
import dk.sdu.cloud.service.Loggable

class FileController(
    private val userCloudService: UserCloudService,
    private val fileAnnotationService: FileAnnotationService
) : Controller {
    override fun configure(rpcServer: RpcServer) = with(rpcServer) {
        implement(FileGatewayDescriptions.listAtDirectory) {
            val userCloud = userCloudService.createUserCloud(ctx as HttpCall)

            val pageOfFiles = FileDescriptions.listAtPath.call(
                ListDirectoryRequest(
                    path = request.path,
                    itemsPerPage = request.itemsPerPage,
                    page = request.page,
                    order = request.order,
                    sortBy = request.sortBy
                ),
                userCloud
            ).orThrow()

            ok(
                pageOfFiles.withNewItems(
                    fileAnnotationService.annotate(request.resourcesToLoad, pageOfFiles.items, userCloud)
                )
            )
        }

        implement(FileGatewayDescriptions.lookupFileInDirectory) {
            val userCloud = userCloudService.createUserCloud(ctx as HttpCall)

            val result = FileDescriptions.lookupFileInDirectory.call(
                LookupFileInDirectoryRequest(
                    request.path,
                    request.itemsPerPage,
                    request.order,
                    request.sortBy
                ),
                userCloud
            ).orThrow()

            ok(
                result.withNewItems(
                    fileAnnotationService.annotate(request.resourcesToLoad, result.items, userCloud)
                )
            )
        }

        implement(FileGatewayDescriptions.stat) {
            val userCloud = userCloudService.createUserCloud(ctx as HttpCall)

            val result = FileDescriptions.stat.call(
                FindByPath(request.path),
                userCloud
            ).orThrow()

            ok(fileAnnotationService.annotate(request.resourcesToLoad, listOf(result), userCloud).single())
        }
    }

    companion object : Loggable {
        override val log = logger()
    }
}