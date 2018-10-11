package dk.sdu.cloud.indexing.services

import dk.sdu.cloud.file.api.EventMaterializedStorageFile
import dk.sdu.cloud.file.api.StorageEvent
import dk.sdu.cloud.filesearch.api.SearchResult

interface Migratable {
    fun migrate() {}
}

fun EventMaterializedStorageFile.toExternalResult(): SearchResult =
    SearchResult(path, fileType)

data class BulkIndexingResponse(
    val failures: List<String>
)

interface IndexingService : Migratable {
    fun handleEvent(event: StorageEvent)

    fun bulkHandleEvent(events: List<StorageEvent>): BulkIndexingResponse {
        events.forEach { handleEvent(it) }
        return BulkIndexingResponse(emptyList())
    }
}
