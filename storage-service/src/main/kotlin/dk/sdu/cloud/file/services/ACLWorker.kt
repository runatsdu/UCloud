package dk.sdu.cloud.file.services

import com.fasterxml.jackson.module.kotlin.readValue
import dk.sdu.cloud.defaultMapper
import dk.sdu.cloud.file.SERVICE_USER
import dk.sdu.cloud.file.api.UpdateAclRequest
import dk.sdu.cloud.file.services.background.BackgroundExecutor
import dk.sdu.cloud.file.services.background.BackgroundResponse
import dk.sdu.cloud.file.util.unwrap
import dk.sdu.cloud.service.Loggable
import io.ktor.http.HttpStatusCode

private data class UpdateRequest(val request: UpdateAclRequest)

class ACLWorker<Ctx : FSUserContext>(
    private val fsCommandRunnerFactory: FSCommandRunnerFactory<Ctx>,
    private val fs: LowLevelFileSystemInterface<Ctx>,
    private val backgroundExecutor: BackgroundExecutor<*>
) {
    fun registerWorkers() {
        backgroundExecutor.addWorker(REQUEST_TYPE) { _, message ->
            fsCommandRunnerFactory.withBlockingContext(SERVICE_USER) { ctx ->
                val parsed = defaultMapper.readValue<UpdateRequest>(message)
                val (request) = parsed
                log.debug("Executing ACL update request: $request")

                request.changes.forEach { change ->
                    val entity = FSACLEntity(change.entity)

                    if (change.revoke) {
                        fs.removeACLEntry(ctx, request.path, entity).unwrap()
                    } else {
                        fs.createACLEntry(ctx, request.path, entity, change.rights).unwrap()
                    }
                }

                BackgroundResponse(HttpStatusCode.OK, Unit)
            }
        }
    }

    suspend fun updateAcl(request: UpdateAclRequest, user: String): String {
        return backgroundExecutor.addJobToQueue(REQUEST_TYPE, UpdateRequest(request), user)
    }

    companion object : Loggable {
        const val REQUEST_TYPE = "updateAcl"
        override val log = logger()
    }
}
