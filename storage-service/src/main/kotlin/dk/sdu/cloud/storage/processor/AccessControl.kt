package dk.sdu.cloud.storage.processor

import dk.sdu.cloud.service.KafkaRequest
import dk.sdu.cloud.storage.Result
import org.apache.kafka.streams.StreamsBuilder
import dk.sdu.cloud.storage.model.AccessControlProcessor
import dk.sdu.cloud.storage.model.UpdateACLRequest

class AccessControl(private val storageService: StorageService) {
    fun initStream(builder: StreamsBuilder) {
        AccessControlProcessor.UpdateACL.process(builder) { _, request -> updateACL(request) }
    }

    // TODO I'm not sure about the Entity type this will not serialize well.
    private fun updateACL(request: KafkaRequest<UpdateACLRequest>): Result<Unit> {
        val connection = storageService.validateRequest(request.header).capture() ?: return Result.lastError()
        connection.use {
            val path = connection.paths.parseAbsolute(request.event.path, addHost = true)
            return connection.accessControl.updateACL(path, listOf(request.event.newEntry))
        }
    }
}
